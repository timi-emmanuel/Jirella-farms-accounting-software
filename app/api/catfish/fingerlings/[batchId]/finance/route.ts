/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { batchId } = await context.params;
    if (!batchId) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });

    const admin = createAdminClient();

    const { data: batch, error: batchError } = await admin
      .from('CatfishBatch')
      .select('id, batchName, status, startDate, initialStock, initialSeedCost, productionType')
      .eq('id', batchId)
      .eq('productionType', 'Fingerlings')
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const { data: feedLogs, error: feedError } = await admin
      .from('CatfishDailyLog')
      .select('feedAmountKg, dailyFeedCost, mortalityCount, abwGrams, logDate, createdAt')
      .eq('batchId', batchId)
      .order('logDate', { ascending: false })
      .order('createdAt', { ascending: false });

    if (feedError) {
      return NextResponse.json({ error: feedError.message }, { status: 400 });
    }

    const { data: sales, error: salesError } = await admin
      .from('CatfishSale')
      .select('quantitySold, totalSaleValue')
      .eq('batchId', batchId);

    if (salesError) {
      return NextResponse.json({ error: salesError.message }, { status: 400 });
    }

    const totalFeedCost = roundTo2(
      (feedLogs || []).reduce((sum: number, row: any) => sum + Number(row.dailyFeedCost || 0), 0)
    );
    const totalFeedKg = roundTo2(
      (feedLogs || []).reduce((sum: number, row: any) => sum + Number(row.feedAmountKg || 0), 0)
    );
    const totalMortality = (feedLogs || []).reduce(
      (sum: number, row: any) => sum + Number(row.mortalityCount || 0),
      0
    );

    const latestAbwRow = (feedLogs || []).find((row: any) => Number(row.abwGrams || 0) > 0);
    const latestAbwGrams = latestAbwRow ? Number(latestAbwRow.abwGrams || 0) : 0;

    const totalExternalRevenue = roundTo2(
      (sales || []).reduce((sum: number, row: any) => sum + Number(row.totalSaleValue || 0), 0)
    );
    const totalSold = (sales || []).reduce((sum: number, row: any) => sum + Number(row.quantitySold || 0), 0);

    const initialStock = Number(batch.initialStock || 0);
    const seedCost = roundTo2(Number(batch.initialSeedCost || 0));
    const otherExpenses = 0;
    const totalOperationalCost = roundTo2(totalFeedCost + otherExpenses);
    const totalExpenses = roundTo2(seedCost + totalOperationalCost);

    const currentStock = Math.max(0, initialStock - totalMortality - totalSold);
    const totalBiomassKg = latestAbwGrams > 0 ? roundTo2((currentStock * latestAbwGrams) / 1000) : 0;

    const transferRevenue = 0;
    const totalRevenue = roundTo2(totalExternalRevenue + transferRevenue);
    const grossProfit = roundTo2(totalRevenue - totalExpenses);
    const profitMargin = totalRevenue > 0 ? roundTo2((grossProfit / totalRevenue) * 100) : null;
    const costPerFish = currentStock > 0 ? roundTo2(totalExpenses / currentStock) : null;
    const costPerKg = totalBiomassKg > 0 ? roundTo2(totalExpenses / totalBiomassKg) : null;
    const feedCostSharePercent = totalExpenses > 0 ? roundTo2((totalFeedCost / totalExpenses) * 100) : null;

    return NextResponse.json({
      finance: {
        batchId: batch.id,
        batchName: batch.batchName,
        status: batch.status,
        startDate: batch.startDate,
        initialStock,
        currentStock,
        totalSold,
        totalMortality,
        latestAbwGrams,
        totalBiomassKg,
        totalFeedKg,
        totalFeedCost,
        seedCost,
        otherExpenses,
        totalOperationalCost,
        totalExpenses,
        totalExternalRevenue,
        transferRevenue,
        totalRevenue,
        grossProfit,
        profitMargin,
        costPerFish,
        costPerKg,
        feedCostSharePercent
      }
    });
  } catch (error: any) {
    console.error('Catfish fingerlings finance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
