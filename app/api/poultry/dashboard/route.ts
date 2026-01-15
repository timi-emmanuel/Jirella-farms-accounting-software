import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const to = searchParams.get('to') ?? new Date().toISOString().split('T')[0];
    const fromDefault = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const from = searchParams.get('from') ?? fromDefault;

    const admin = createAdminClient();

    const { data: flocks } = await admin
      .from('PoultryFlock')
      .select('currentCount')
      .eq('status', 'ACTIVE');

    const currentLiveBirds = (flocks || []).reduce((sum, row: any) => sum + Number(row.currentCount || 0), 0);

    const { data: logs, error: logsError } = await admin
      .from('PoultryDailyLog')
      .select('date, eggsCollected, eggsDamaged, mortality, feedConsumedKg')
      .gte('date', from)
      .lte('date', to);

    if (logsError) return NextResponse.json({ error: logsError.message }, { status: 400 });

    let totalEggs = 0;
    let totalDamaged = 0;
    let totalMortality = 0;
    let totalFeedKg = 0;
    let latestDate = '';
    const eggsByDate = new Map<string, number>();

    (logs || []).forEach((log: any) => {
      const eggs = Number(log.eggsCollected || 0);
      const damaged = Number(log.eggsDamaged || 0);
      totalEggs += eggs;
      totalDamaged += damaged;
      totalMortality += Number(log.mortality || 0);
      totalFeedKg += Number(log.feedConsumedKg || 0);

      if (!latestDate || log.date > latestDate) latestDate = log.date;
      const current = eggsByDate.get(log.date) || 0;
      eggsByDate.set(log.date, current + eggs);
    });

    const eggsLatest = latestDate ? (eggsByDate.get(latestDate) || 0) : 0;
    const henDayProduction = currentLiveBirds > 0
      ? roundTo2((eggsLatest / currentLiveBirds) * 100)
      : 0;

    const feedPerBirdG = currentLiveBirds > 0
      ? roundTo2((totalFeedKg * 1000) / currentLiveBirds)
      : 0;

    const fcrPerDozen = totalEggs > 0
      ? roundTo2(totalFeedKg / (totalEggs / 12))
      : 0;

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'POULTRY')
      .single();

    let totalFeedCost = 0;
    if (location) {
      const { data: ledger } = await admin
        .from('InventoryLedger')
        .select('quantity, unitCost, createdAt')
        .eq('locationId', location.id)
        .eq('type', 'USAGE')
        .eq('referenceType', 'POULTRY_DAILY_LOG')
        .gte('createdAt', `${from}T00:00:00`)
        .lte('createdAt', `${to}T23:59:59`);

      (ledger || []).forEach((entry: any) => {
        totalFeedCost += Number(entry.quantity || 0) * Number(entry.unitCost || 0);
      });
    }

    const crates = totalEggs > 0 ? totalEggs / 30 : 0;
    const costPerCrate = crates > 0 ? roundTo2(totalFeedCost / crates) : 0;

    const { data: sales } = await admin
      .from('Sale')
      .select('quantitySold, unitSellingPrice, unitCostAtSale, soldAt')
      .eq('module', 'POULTRY')
      .gte('soldAt', from)
      .lte('soldAt', to);

    let totalSales = 0;
    let totalCogs = 0;
    (sales || []).forEach((sale: any) => {
      totalSales += Number(sale.quantitySold || 0) * Number(sale.unitSellingPrice || 0);
      totalCogs += Number(sale.quantitySold || 0) * Number(sale.unitCostAtSale || 0);
    });

    const { data: expenses } = await admin
      .from('Expense')
      .select('amount, spentAt')
      .eq('module', 'POULTRY')
      .gte('spentAt', from)
      .lte('spentAt', to);

    const totalExpenses = (expenses || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const profit = roundTo2(totalSales - totalCogs - totalExpenses);

    return NextResponse.json({
      metrics: {
        totalEggs,
        totalDamaged,
        totalMortality,
        totalFeedKg: roundTo2(totalFeedKg),
        currentLiveBirds,
        henDayProduction,
        feedPerBirdG,
        fcrPerDozen,
        costPerCrate,
        totalSales: roundTo2(totalSales),
        totalCogs: roundTo2(totalCogs),
        totalExpenses: roundTo2(totalExpenses),
        profit
      }
    });
  } catch (error: any) {
    console.error('Poultry dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
