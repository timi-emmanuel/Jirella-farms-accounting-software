import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];

type PnlRow = {
  month: string;
  revenue: number;
  feedCost: number;
  energyCost: number;
  totalCogs: number;
  grossProfit: number;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to') ?? new Date().toISOString().split('T')[0];
    const fromDefault = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const from = searchParams.get('from') ?? fromDefault;

    const admin = createAdminClient();

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    const { data: sales } = await admin
      .from('Sale')
      .select('soldAt, quantitySold, unitSellingPrice')
      .eq('module', 'BSF')
      .gte('soldAt', from)
      .lte('soldAt', to);

    const { data: ledger } = await admin
      .from('InventoryLedger')
      .select('createdAt, quantity, unitCost')
      .eq('locationId', location?.id ?? '')
      .eq('referenceType', 'BSF_FEED_LOG')
      .gte('createdAt', `${from}T00:00:00`)
      .lte('createdAt', `${to}T23:59:59`);

    const { data: runs } = await admin
      .from('BsfProcessingRun')
      .select('runAt, energyCostEstimate')
      .gte('runAt', `${from}T00:00:00`)
      .lte('runAt', `${to}T23:59:59`);

    const map = new Map<string, PnlRow>();
    const ensureRow = (month: string) => {
      if (!map.has(month)) {
        map.set(month, { month, revenue: 0, feedCost: 0, energyCost: 0, totalCogs: 0, grossProfit: 0 });
      }
      return map.get(month)!;
    };

    (sales || []).forEach((sale: any) => {
      const month = sale.soldAt?.slice(0, 7) ?? 'Unknown';
      const row = ensureRow(month);
      row.revenue += Number(sale.quantitySold || 0) * Number(sale.unitSellingPrice || 0);
    });

    (ledger || []).forEach((entry: any) => {
      const month = entry.createdAt?.slice(0, 7) ?? 'Unknown';
      const row = ensureRow(month);
      row.feedCost += Number(entry.quantity || 0) * Number(entry.unitCost || 0);
    });

    (runs || []).forEach((run: any) => {
      const month = run.runAt?.slice(0, 7) ?? 'Unknown';
      const row = ensureRow(month);
      row.energyCost += Number(run.energyCostEstimate || 0);
    });

    const rows = Array.from(map.values()).map((row) => {
      row.revenue = roundTo2(row.revenue);
      row.feedCost = roundTo2(row.feedCost);
      row.energyCost = roundTo2(row.energyCost);
      row.totalCogs = roundTo2(row.feedCost + row.energyCost);
      row.grossProfit = roundTo2(row.revenue - row.totalCogs);
      return row;
    }).sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error('BSF P&L error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
