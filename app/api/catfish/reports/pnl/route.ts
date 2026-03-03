/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];

const monthKey = (dateString?: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return month;
};

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: sales } = await admin
      .from('CatfishSale')
      .select('saleDate, totalSaleValue, batch:CatfishBatch(productionType)');

    const { data: feedLogs } = await admin
      .from('CatfishDailyLog')
      .select('logDate, dailyFeedCost, batch:CatfishBatch(productionType)');

    const { data: batches } = await admin
      .from('CatfishBatch')
      .select('startDate, initialSeedCost, productionType');

    const { data: expenses } = await admin
      .from('Expense')
      .select('spentAt, amount')
      .eq('module', 'CATFISH');

    const ledger = new Map<string, { fishType: string; revenue: number; feedCost: number; fingerlingCost: number; externalExpenses: number }>();

    (sales || []).forEach((row: any) => {
      const month = monthKey(row.saleDate);
      if (!month) return;
      const fishType = row.batch?.productionType || 'Fingerlings';
      const key = `${month}|${fishType}`;
      if (!key) return;
      const entry = ledger.get(key) || { fishType, revenue: 0, feedCost: 0, fingerlingCost: 0, externalExpenses: 0 };
      entry.revenue += Number(row.totalSaleValue || 0);
      ledger.set(key, entry);
    });

    (feedLogs || []).forEach((row: any) => {
      const month = monthKey(row.logDate);
      if (!month) return;
      const fishType = row.batch?.productionType || 'Fingerlings';
      const key = `${month}|${fishType}`;
      if (!key) return;
      const entry = ledger.get(key) || { fishType, revenue: 0, feedCost: 0, fingerlingCost: 0, externalExpenses: 0 };
      entry.feedCost += Number(row.dailyFeedCost || 0);
      ledger.set(key, entry);
    });

    (batches || []).forEach((row: any) => {
      const month = monthKey(row.startDate);
      if (!month) return;
      const fishType = row.productionType || 'Fingerlings';
      const key = `${month}|${fishType}`;
      if (!key) return;
      const entry = ledger.get(key) || { fishType, revenue: 0, feedCost: 0, fingerlingCost: 0, externalExpenses: 0 };
      entry.fingerlingCost += Number(row.initialSeedCost || 0);
      ledger.set(key, entry);
    });

    (expenses || []).forEach((row: any) => {
      const month = monthKey(row.spentAt);
      if (!month) return;
      // Current schema is Fingerlings-only; attach external costs to this type.
      const fishType = 'Fingerlings';
      const key = `${month}|${fishType}`;
      const entry = ledger.get(key) || { fishType, revenue: 0, feedCost: 0, fingerlingCost: 0, externalExpenses: 0 };
      entry.externalExpenses += Number(row.amount || 0);
      ledger.set(key, entry);
    });

    const rows = Array.from(ledger.entries())
      .map(([compoundKey, values]) => {
        const [month] = compoundKey.split('|');
        const feedCost = roundTo2(values.feedCost);
        const fingerlingCost = roundTo2(values.fingerlingCost);
        const externalExpenses = roundTo2(values.externalExpenses);
        const revenue = roundTo2(values.revenue);
        const totalCogs = roundTo2(feedCost + fingerlingCost + externalExpenses);
        const grossProfit = roundTo2(revenue - totalCogs);
        return {
          month,
          fishType: values.fishType,
          revenue,
          feedCost,
          fingerlingCost,
          externalExpenses,
          totalCogs,
          grossProfit
        };
      })
      .sort((a, b) => {
        const monthDiff = b.month.localeCompare(a.month);
        if (monthDiff !== 0) return monthDiff;
        return a.fishType.localeCompare(b.fishType);
      });

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error('Catfish P&L report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
