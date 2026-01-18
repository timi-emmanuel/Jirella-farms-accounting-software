import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF', 'ACCOUNTANT'];

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
      .from('BsfBatchFeedLog')
      .select('date, pkcKg, poultryWasteKg')
      .gte('date', from)
      .lte('date', to);

    const totalFeedKg = roundTo2((feedLogs || []).reduce((sum: number, row: any) => {
      return sum + Number(row.pkcKg || 0) + Number(row.poultryWasteKg || 0);
    }, 0));

    const { data: harvests } = await admin
      .from('BsfHarvestYield')
      .select('wetLarvaeKg, createdAt, batch:BsfLarvariumBatch(batchCode, initialLarvaeWeightGrams)')
      .gte('createdAt', `${from}T00:00:00`)
      .lte('createdAt', `${to}T23:59:59`);

    const totalWetLarvaeKg = roundTo2((harvests || []).reduce((sum: number, row: any) => sum + Number(row.wetLarvaeKg || 0), 0));
    const fcr = totalFeedKg > 0 ? roundTo2(totalWetLarvaeKg / totalFeedKg) : 0;

    const { data: insectorium } = await admin
      .from('BsfInsectoriumLog')
      .select('pupaeLoadedKg, eggsHarvestedGrams, date')
      .gte('date', from)
      .lte('date', to);

    const totalPupae = (insectorium || []).reduce((sum: number, row: any) => sum + Number(row.pupaeLoadedKg || 0), 0);
    const totalEggs = (insectorium || []).reduce((sum: number, row: any) => sum + Number(row.eggsHarvestedGrams || 0), 0);
    const breedingEfficiency = totalPupae > 0 ? roundTo2(totalEggs / totalPupae) : 0;

    const { data: processing } = await admin
      .from('BsfProcessingRun')
      .select('processType, inputWeightKg, outputLarvaeOilLiters, runAt')
      .eq('processType', 'PRESSING_EXTRACTION')
      .gte('runAt', `${from}T00:00:00`)
      .lte('runAt', `${to}T23:59:59`);

    const totalPressInput = (processing || []).reduce((sum: number, row: any) => sum + Number(row.inputWeightKg || 0), 0);
    const totalOil = (processing || []).reduce((sum: number, row: any) => sum + Number(row.outputLarvaeOilLiters || 0), 0);
    const oilExtractionRate = totalPressInput > 0 ? roundTo2((totalOil / totalPressInput) * 100) : 0;

    const survivalProxy = (harvests || []).length > 0
      ? roundTo2((harvests || []).reduce((sum: number, row: any) => {
        const initial = Number(row.batch?.initialLarvaeWeightGrams || 0) / 1000;
        if (initial <= 0) return sum;
        return sum + (Number(row.wetLarvaeKg || 0) / initial);
      }, 0) / (harvests || []).length)
      : 0;

    const yieldByBatch = (harvests || [])
      .slice(0, 10)
      .map((row: any) => ({
        batchCode: row.batch?.batchCode ?? 'Unknown',
        wetLarvaeKg: Number(row.wetLarvaeKg || 0)
      }));

    return NextResponse.json({
      metrics: {
        totalFeedKg,
        totalWetLarvaeKg,
        fcr,
        breedingEfficiency,
        oilExtractionRate,
        survivalProxy,
        yieldByBatch
      }
    });
  } catch (error: any) {
    console.error('BSF dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
