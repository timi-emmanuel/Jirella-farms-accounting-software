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
      .from('Sale')
      .select('soldAt, quantitySold, unitSellingPrice')
      .eq('module', 'CATFISH');

    const { data: feedLogs } = await admin
      .from('CatfishFeedLog')
      .select('date, totalCost');

    const { data: batches } = await admin
      .from('CatfishBatch')
      .select('startDate, totalFingerlingCost');

    const ledger = new Map<string, { revenue: number; feedCost: number; fingerlingCost: number }>();

    (sales || []).forEach((row: any) => {
      const key = monthKey(row.soldAt);
      if (!key) return;
      const entry = ledger.get(key) || { revenue: 0, feedCost: 0, fingerlingCost: 0 };
      entry.revenue += Number(row.quantitySold || 0) * Number(row.unitSellingPrice || 0);
      ledger.set(key, entry);
    });

    (feedLogs || []).forEach((row: any) => {
      const key = monthKey(row.date);
      if (!key) return;
      const entry = ledger.get(key) || { revenue: 0, feedCost: 0, fingerlingCost: 0 };
      entry.feedCost += Number(row.totalCost || 0);
      ledger.set(key, entry);
    });

    (batches || []).forEach((row: any) => {
      const key = monthKey(row.startDate);
      if (!key) return;
      const entry = ledger.get(key) || { revenue: 0, feedCost: 0, fingerlingCost: 0 };
      entry.fingerlingCost += Number(row.totalFingerlingCost || 0);
      ledger.set(key, entry);
    });

    const rows = Array.from(ledger.entries())
      .map(([month, values]) => {
        const feedCost = roundTo2(values.feedCost);
        const fingerlingCost = roundTo2(values.fingerlingCost);
        const revenue = roundTo2(values.revenue);
        const totalCogs = roundTo2(feedCost + fingerlingCost);
        const grossProfit = roundTo2(revenue - totalCogs);
        return {
          month,
          revenue,
          feedCost,
          fingerlingCost,
          totalCogs,
          grossProfit
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error('Catfish P&L report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
