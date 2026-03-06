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
      .select('id, batchName, startDate, initialStock, initialSeedCost, status, productionType');

    const logBatchIds = Array.from(
      new Set((dailyLogs || []).map((row: any) => String(row.batchId || '')).filter(Boolean))
    );
    const { data: fcrBatches } = logBatchIds.length > 0
      ? await admin
          .from('CatfishBatch')
          .select('id, initialStock')
          .in('id', logBatchIds)
      : { data: [] as any[] };

    const batchInitialStock = new Map<string, number>();
    (fcrBatches || []).forEach((row: any) => {
      batchInitialStock.set(String(row.id), Number(row.initialStock || 0));
    });

    const mortalityByBatch = new Map<string, number>();
    (dailyLogs || []).forEach((row: any) => {
      const key = String(row.batchId || '');
      if (!key) return;
      mortalityByBatch.set(key, (mortalityByBatch.get(key) || 0) + Number(row.mortalityCount || 0));
    });

    const soldByBatch = new Map<string, number>();
    (sales || []).forEach((row: any) => {
      const key = String(row.batchId || '');
      if (!key) return;
      soldByBatch.set(key, (soldByBatch.get(key) || 0) + Number(row.quantitySold || 0));
    });

    const abwByBatch = new Map<string, { abw: number; date: string }[]>();
    (dailyLogs || []).forEach((row: any) => {
      const batchKey = String(row.batchId || '');
      const abw = Number(row.abwGrams || 0);
      if (!batchKey || abw <= 0) return;
      const list = abwByBatch.get(batchKey) || [];
      list.push({ abw, date: String(row.logDate || '') });
      abwByBatch.set(batchKey, list);
    });

    let totalWeightGainedKg = 0;
    abwByBatch.forEach((series, batchKey) => {
      const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 2) return;
      const startAbw = Number(sorted[0].abw || 0);
      const endAbw = Number(sorted[sorted.length - 1].abw || 0);
      const gainPerFishKg = (endAbw - startAbw) / 1000;
      if (gainPerFishKg <= 0) return;

      const baseStock = Number(batchInitialStock.get(batchKey) || 0);
      const mortality = Number(mortalityByBatch.get(batchKey) || 0);
      const sold = Number(soldByBatch.get(batchKey) || 0);
      const estimatedPopulation = Math.max(0, baseStock - mortality - sold);

      totalWeightGainedKg += gainPerFishKg * estimatedPopulation;
    });
    totalWeightGainedKg = roundTo2(totalWeightGainedKg);
    const fcr = totalWeightGainedKg > 0 ? roundTo2(totalFeedKg / totalWeightGainedKg) : 0;

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
        totalWeightGainedKg,
        fcr,
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
