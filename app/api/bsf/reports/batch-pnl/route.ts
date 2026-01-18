import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: batches, error } = await admin
      .from('BsfLarvariumBatch')
      .select('id, batchCode, startDate, status')
      .order('startDate', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const batchIds = (batches || []).map((b: any) => b.id);

    const { data: sales } = await admin
      .from('Sale')
      .select('batchId, quantitySold, unitSellingPrice')
      .eq('module', 'BSF')
      .in('batchId', batchIds);

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    const { data: ledger } = await admin
      .from('InventoryLedger')
      .select('referenceId, quantity, unitCost')
      .eq('locationId', location?.id ?? '')
      .eq('referenceType', 'BSF_FEED_LOG')
      .in('referenceId', batchIds);

    const { data: runs } = await admin
      .from('BsfProcessingRun')
      .select('batchId, energyCostEstimate')
      .in('batchId', batchIds);

    const salesMap = new Map<string, number>();
    (sales || []).forEach((sale: any) => {
      const current = salesMap.get(sale.batchId) || 0;
      salesMap.set(sale.batchId, current + Number(sale.quantitySold || 0) * Number(sale.unitSellingPrice || 0));
    });

    const feedMap = new Map<string, number>();
    (ledger || []).forEach((entry: any) => {
      const current = feedMap.get(entry.referenceId) || 0;
      feedMap.set(entry.referenceId, current + Number(entry.quantity || 0) * Number(entry.unitCost || 0));
    });

    const energyMap = new Map<string, number>();
    (runs || []).forEach((run: any) => {
      const current = energyMap.get(run.batchId) || 0;
      energyMap.set(run.batchId, current + Number(run.energyCostEstimate || 0));
    });

    const rows = (batches || []).map((batch: any) => {
      const revenue = roundTo2(salesMap.get(batch.id) || 0);
      const feedCost = roundTo2(feedMap.get(batch.id) || 0);
      const energyCost = roundTo2(energyMap.get(batch.id) || 0);
      const totalCogs = roundTo2(feedCost + energyCost);
      const profit = roundTo2(revenue - totalCogs);
      return {
        batchId: batch.id,
        batchCode: batch.batchCode,
        status: batch.status,
        startDate: batch.startDate,
        revenue,
        feedCost,
        energyCost,
        totalCogs,
        profit
      };
    });

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error('BSF batch P&L error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
