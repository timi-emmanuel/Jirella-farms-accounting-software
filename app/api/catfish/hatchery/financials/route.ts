/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient();
    const [{ data: broodstock }, { data: spawning }, { data: transfers }] = await Promise.all([
      admin.from('CatfishBroodstockLog').select('dailyFeedCost'),
      admin.from('CatfishSpawningEvent').select('hormoneCost, maleFishCost'),
      admin.from('CatfishFryTransfer').select('liveFryCount, totalTransferValue')
    ]);

    const totalBroodstockFeedCost = roundTo2((broodstock || []).reduce((sum: number, row: any) => sum + Number(row.dailyFeedCost || 0), 0));
    const totalHormoneCost = roundTo2((spawning || []).reduce((sum: number, row: any) => sum + Number(row.hormoneCost || 0), 0));
    const totalMaleFishCost = roundTo2((spawning || []).reduce((sum: number, row: any) => sum + Number(row.maleFishCost || 0), 0));
    const totalFryProduced = (transfers || []).reduce((sum: number, row: any) => sum + Number(row.liveFryCount || 0), 0);
    const totalTransferValue = roundTo2((transfers || []).reduce((sum: number, row: any) => sum + Number(row.totalTransferValue || 0), 0));

    return NextResponse.json({
      metrics: {
        totalBroodstockFeedCost,
        totalHormoneCost,
        totalMaleFishCost,
        totalFryProduced,
        totalTransferValue
      }
    });
  } catch (error: any) {
    console.error('Catfish hatchery financials error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
