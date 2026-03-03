/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];

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

    const { data: dailyLogs } = await admin
      .from('CatfishDailyLog')
      .select('batchId, logDate, feedAmountKg, dailyFeedCost, mortalityCount, abwGrams')
      .gte('logDate', from)
      .lte('logDate', to);

    const totalFeedKg = roundTo2((dailyLogs || []).reduce((sum: number, row: any) => sum + Number(row.feedAmountKg || 0), 0));
    const totalFeedCost = roundTo2((dailyLogs || []).reduce((sum: number, row: any) => sum + Number(row.dailyFeedCost || 0), 0));
    const totalMortality = Math.round((dailyLogs || []).reduce((sum: number, row: any) => sum + Number(row.mortalityCount || 0), 0));

    const abwValues = (dailyLogs || [])
      .map((row: any) => Number(row.abwGrams || 0))
      .filter((v: number) => v > 0);
    const averageAbwGrams = abwValues.length > 0
      ? roundTo2(abwValues.reduce((sum: number, value: number) => sum + value, 0) / abwValues.length)
      : 0;

    const { data: sales } = await admin
      .from('CatfishSale')
      .select('batchId, saleDate, quantitySold, totalSaleValue')
      .gte('saleDate', from)
      .lte('saleDate', to);

    const totalSold = Math.round((sales || []).reduce((sum: number, row: any) => sum + Number(row.quantitySold || 0), 0));
    const totalRevenue = roundTo2((sales || []).reduce((sum: number, row: any) => sum + Number(row.totalSaleValue || 0), 0));

    const { data: batches } = await admin
      .from('CatfishBatch')
      .select('id, batchName, startDate, initialStock, initialSeedCost, status')
      .eq('productionType', 'Fingerlings');

    const activeBatches = (batches || []).filter((row: any) => row.status === 'Active').length;
    const stockedInRange = (batches || [])
      .filter((row: any) => row.startDate >= from && row.startDate <= to)
      .reduce((sum: number, row: any) => sum + Number(row.initialStock || 0), 0);

    const survivalRate = stockedInRange > 0
      ? roundTo2(((stockedInRange - totalMortality) / stockedInRange) * 100)
      : 0;

    const salesByBatch = (sales || [])
      .reduce((map: Map<string, number>, row: any) => {
        const key = String(row.batchId || 'Unknown');
        map.set(key, (map.get(key) || 0) + Number(row.quantitySold || 0));
        return map;
      }, new Map<string, number>());

    const batchNameMap = new Map<string, string>();
    (batches || []).forEach((batch: any) => batchNameMap.set(batch.id, batch.batchName || 'Unknown'));

    const yieldByBatch = Array.from(salesByBatch.entries())
      .map(([batchId, quantity]) => ({
        batchCode: batchNameMap.get(batchId) || 'Unknown',
        quantityKg: roundTo2(quantity)
      }))
      .slice(0, 10);

    return NextResponse.json({
      metrics: {
        totalFeedKg,
        totalFeedCost,
        totalSold,
        totalHarvestKg: totalSold,
        totalMortality,
        survivalRate,
        averageAbwGrams,
        totalRevenue,
        activeBatches,
        yieldByBatch
      }
    });
  } catch (error: any) {
    console.error('Catfish dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
