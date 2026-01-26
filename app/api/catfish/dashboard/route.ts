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

    const { data: feedLogs } = await admin
      .from('CatfishFeedLog')
      .select('date, quantityKg')
      .gte('date', from)
      .lte('date', to);

    const totalFeedKg = roundTo2((feedLogs || []).reduce((sum: number, row: any) => sum + Number(row.quantityKg || 0), 0));

    const { data: harvests } = await admin
      .from('CatfishHarvest')
      .select('quantityKg, averageFishWeightKg, date, batch:CatfishBatch(batchCode)')
      .gte('date', from)
      .lte('date', to);

    const totalHarvestKg = roundTo2((harvests || []).reduce((sum: number, row: any) => sum + Number(row.quantityKg || 0), 0));

    const avgWeightValues = (harvests || []).map((row: any) => Number(row.averageFishWeightKg || 0)).filter((v: number) => v > 0);
    const averageHarvestWeightKg = avgWeightValues.length > 0
      ? roundTo2(avgWeightValues.reduce((sum: number, v: number) => sum + v, 0) / avgWeightValues.length)
      : 0;

    const harvestedCount = (harvests || []).reduce((sum: number, row: any) => {
      const avg = Number(row.averageFishWeightKg || 0);
      if (avg <= 0) return sum;
      return sum + (Number(row.quantityKg || 0) / avg);
    }, 0);

    const { data: mortality } = await admin
      .from('CatfishMortalityLog')
      .select('deadCount, date')
      .gte('date', from)
      .lte('date', to);

    const totalMortality = Math.round((mortality || []).reduce((sum: number, row: any) => sum + Number(row.deadCount || 0), 0));

    const { data: batches } = await admin
      .from('CatfishBatch')
      .select('id, startDate, initialFingerlingsCount, status');

    const fingerlingsInRange = (batches || []).filter((row: any) => row.startDate >= from && row.startDate <= to)
      .reduce((sum: number, row: any) => sum + Number(row.initialFingerlingsCount || 0), 0);

    const survivalRate = fingerlingsInRange > 0
      ? roundTo2((harvestedCount / fingerlingsInRange) * 100)
      : 0;

    const activeBatches = (batches || []).filter((row: any) => ['GROWING', 'HARVESTING'].includes(row.status)).length;

    const { data: sales } = await admin
      .from('Sale')
      .select('quantitySold, unitSellingPrice, soldAt')
      .eq('module', 'CATFISH')
      .gte('soldAt', from)
      .lte('soldAt', to);

    const totalRevenue = roundTo2((sales || []).reduce((sum: number, row: any) => {
      return sum + (Number(row.quantitySold || 0) * Number(row.unitSellingPrice || 0));
    }, 0));

    const yieldByBatch = (harvests || [])
      .reduce((map: Map<string, number>, row: any) => {
        const key = row.batch?.batchCode ?? 'Unknown';
        map.set(key, (map.get(key) || 0) + Number(row.quantityKg || 0));
        return map;
      }, new Map())
      .entries();

    const yieldRows = Array.from(yieldByBatch)
      .map(([batchCode, quantityKg]) => ({ batchCode, quantityKg: roundTo2(quantityKg) }))
      .slice(0, 10);

    return NextResponse.json({
      metrics: {
        totalFeedKg,
        totalHarvestKg,
        totalMortality,
        survivalRate,
        averageHarvestWeightKg,
        totalRevenue,
        activeBatches,
        yieldByBatch: yieldRows
      }
    });
  } catch (error: any) {
    console.error('Catfish dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
