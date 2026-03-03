/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

const getAvailableStock = async (admin: ReturnType<typeof createAdminClient>, batchId: string) => {
  const [{ data: batch }, { data: logs }, { data: sales }, { data: outgoing }, { data: incoming }] = await Promise.all([
    admin.from('CatfishBatch').select('id, initialStock').eq('id', batchId).single(),
    admin.from('CatfishDailyLog').select('mortalityCount').eq('batchId', batchId),
    admin.from('CatfishSale').select('quantitySold').eq('batchId', batchId),
    admin.from('CatfishTransfer').select('quantity, status').eq('fromBatchId', batchId),
    admin.from('CatfishTransfer').select('quantity, status').eq('toBatchId', batchId),
  ]);

  const initialStock = Number(batch?.initialStock || 0);
  const mortality = (logs || []).reduce((sum: number, row: any) => sum + Number(row.mortalityCount || 0), 0);
  const sold = (sales || []).reduce((sum: number, row: any) => sum + Number(row.quantitySold || 0), 0);
  const transferOut = (outgoing || []).reduce((sum: number, row: any) => sum + (row.status === 'COMPLETED' ? Number(row.quantity || 0) : 0), 0);
  const transferIn = (incoming || []).reduce((sum: number, row: any) => sum + (row.status === 'COMPLETED' ? Number(row.quantity || 0) : 0), 0);

  return Math.max(0, initialStock - mortality - sold - transferOut + transferIn);
};

const computeCostPerFish = async (admin: ReturnType<typeof createAdminClient>, batch: any, currentStock: number) => {
  if (currentStock <= 0) return 0;
  const { data: logs } = await admin
    .from('CatfishDailyLog')
    .select('dailyFeedCost')
    .eq('batchId', batch.id);

  const totalFeedCost = roundTo2((logs || []).reduce((sum: number, row: any) => sum + Number(row.dailyFeedCost || 0), 0));
  const baseCost = Number(batch.transferCostBasis || 0) > 0
    ? Number(batch.transferCostBasis || 0)
    : Number(batch.initialSeedCost || 0);
  const totalCost = roundTo2(baseCost + totalFeedCost);
  return roundTo2(totalCost / currentStock);
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    const admin = createAdminClient();
    let query = admin
      .from('CatfishTransfer')
      .select('*, fromBatch:CatfishBatch!CatfishTransfer_fromBatchId_fkey(batchName, productionType), toBatch:CatfishBatch!CatfishTransfer_toBatchId_fkey(batchName, productionType)')
      .order('transferDate', { ascending: false });

    if (batchId) query = query.or(`fromBatchId.eq.${batchId},toBatchId.eq.${batchId}`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ transfers: data || [] });
  } catch (error: any) {
    console.error('Catfish internal sales fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const fromBatchId = String(body.fromBatchId || '');
    const targetStage = body.targetStage === 'Melange' ? 'Melange' : 'Juvenile';
    const transferDate = body.transferDate || new Date().toISOString().split('T')[0];
    const destinationBatchName = String(body.destinationBatchName || '').trim();
    const notes = body.notes ?? null;
    const quantity = Math.max(0, Math.floor(Number(body.quantity || 0)));

    if (!fromBatchId) return NextResponse.json({ error: 'Source batch is required' }, { status: 400 });
    if (quantity <= 0) return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });

    const admin = createAdminClient();
    const { data: sourceBatch, error: sourceError } = await admin
      .from('CatfishBatch')
      .select('id, batchName, productionType, initialSeedCost, transferCostBasis')
      .eq('id', fromBatchId)
      .single();

    if (sourceError || !sourceBatch) return NextResponse.json({ error: 'Source batch not found' }, { status: 404 });

    if (sourceBatch.productionType === 'Fingerlings' && targetStage !== 'Juvenile') {
      return NextResponse.json({ error: 'Fingerlings can only be moved internally to Juvenile' }, { status: 400 });
    }
    if (sourceBatch.productionType === 'Juvenile' && targetStage !== 'Melange') {
      return NextResponse.json({ error: 'Juvenile can only be moved internally to Melange' }, { status: 400 });
    }

    const availableStock = await getAvailableStock(admin, fromBatchId);
    if (quantity > availableStock) {
      return NextResponse.json({ error: `Insufficient stock. Available: ${availableStock}` }, { status: 400 });
    }

    const costPerFishAtTransfer = await computeCostPerFish(admin, sourceBatch, availableStock);
    const transferCostBasis = roundTo2(costPerFishAtTransfer * quantity);
    const nextBatchName = destinationBatchName || `${targetStage}-${sourceBatch.batchName}-${Date.now().toString().slice(-4)}`;

    const { data: destinationBatch, error: destError } = await admin
      .from('CatfishBatch')
      .insert({
        productionType: targetStage,
        batchName: nextBatchName,
        startDate: transferDate,
        initialStock: quantity,
        initialSeedCost: transferCostBasis,
        transferCostBasis,
        parentBatchId: sourceBatch.id,
        status: 'Active'
      })
      .select('id, batchName')
      .single();

    if (destError || !destinationBatch) {
      return NextResponse.json({ error: destError?.message || 'Failed to create destination batch' }, { status: 400 });
    }

    const { data: transfer, error: transferError } = await admin
      .from('CatfishTransfer')
      .insert({
        fromBatchId,
        toBatchId: destinationBatch.id,
        fromStage: sourceBatch.productionType,
        toStage: targetStage,
        transferDate,
        quantity,
        costPerFishAtTransfer,
        transferCostBasis,
        notes,
        status: 'COMPLETED'
      })
      .select('*')
      .single();

    if (transferError) {
      return NextResponse.json({ error: transferError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'CATFISH_INTERNAL_SALE_CREATED',
      entityType: 'CatfishTransfer',
      entityId: transfer.id,
      description: `Internal sale from ${sourceBatch.productionType} to ${targetStage}`,
      metadata: { fromBatchId, toBatchId: destinationBatch.id, quantity, costPerFishAtTransfer, transferCostBasis },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ transfer, destinationBatch });
  } catch (error: any) {
    console.error('Catfish internal sale create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
