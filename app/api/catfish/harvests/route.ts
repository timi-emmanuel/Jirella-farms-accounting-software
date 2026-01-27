import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    let query = admin
      .from('CatfishHarvest')
      .select('*, batch:CatfishBatch(batchCode)')
      .order('date', { ascending: false });

    if (batchId) {
      query = query.eq('batchId', batchId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ harvests: data || [] });
  } catch (error: any) {
    console.error('Catfish harvest fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { batchId, date, quantityKg, fishCountHarvested, averageFishWeightKg, notes, closeBatch } = await request.json();
    if (!batchId || Number(quantityKg) <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: batch, error: batchError } = await admin
      .from('CatfishBatch')
      .select('id, batchCode, totalFingerlingCost, status')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const { data: feedLogs } = await admin
      .from('CatfishFeedLog')
      .select('totalCost')
      .eq('batchId', batchId);

    const feedCost = roundTo2((feedLogs || []).reduce((sum: number, row: any) => sum + Number(row.totalCost || 0), 0));

    const { data: existingHarvests } = await admin
      .from('CatfishHarvest')
      .select('quantityKg, fishCountHarvested')
      .eq('batchId', batchId);

    const existingQty = roundTo2((existingHarvests || []).reduce((sum: number, row: any) => sum + Number(row.quantityKg || 0), 0));
    const newQty = roundTo2(Number(quantityKg));
    const totalHarvestQty = roundTo2(existingQty + newQty);

    const totalCost = roundTo2(feedCost + Number(batch.totalFingerlingCost || 0));
    const unitCostPerKg = totalHarvestQty > 0 ? roundTo2(totalCost / totalHarvestQty) : 0;

    const { data: harvest, error: harvestError } = await admin
      .from('CatfishHarvest')
      .insert({
        batchId,
        date: date ?? new Date().toISOString().split('T')[0],
        quantityKg: newQty,
        fishCountHarvested: Number.isFinite(Number(fishCountHarvested)) ? Math.max(0, Math.floor(Number(fishCountHarvested))) : null,
        averageFishWeightKg: Number(averageFishWeightKg || 0),
        notes: notes ?? null
      })
      .select('*, batch:CatfishBatch(batchCode)')
      .single();

    if (harvestError) return NextResponse.json({ error: harvestError.message }, { status: 400 });

    const { data: product, error: productError } = await admin
      .from('Product')
      .select('id')
      .eq('module', 'CATFISH')
      .eq('name', 'Live Catfish')
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Catfish product not found' }, { status: 400 });
    }

    const { data: location, error: locationError } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'CATFISH')
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Catfish location not found' }, { status: 400 });
    }

    const { data: stock } = await admin
      .from('FinishedGoodsInventory')
      .select('quantityOnHand, averageUnitCost')
      .eq('productId', product.id)
      .eq('locationId', location.id)
      .single();

    const currentQty = roundTo2(Number(stock?.quantityOnHand || 0));
    const currentAvg = roundTo2(Number(stock?.averageUnitCost || 0));
    const nextQty = roundTo2(currentQty + newQty);
    const nextAvg = nextQty > 0
      ? roundTo2(((currentQty * currentAvg) + (newQty * unitCostPerKg)) / nextQty)
      : unitCostPerKg;

    await admin
      .from('FinishedGoodsInventory')
      .upsert({
        productId: product.id,
        locationId: location.id,
        quantityOnHand: nextQty,
        averageUnitCost: nextAvg,
        updatedAt: new Date().toISOString()
      }, { onConflict: 'productId,locationId' });

    await admin
      .from('FinishedGoodsLedger')
      .insert({
        productId: product.id,
        locationId: location.id,
        type: 'PRODUCTION_IN',
        quantity: newQty,
        unitCostAtTime: unitCostPerKg,
        referenceType: 'CATFISH_HARVEST',
        referenceId: harvest.id,
        createdBy: auth.userId
      });

    if (closeBatch) {
      await admin
        .from('CatfishBatch')
        .update({ status: 'CLOSED', updatedAt: new Date().toISOString() })
        .eq('id', batchId);
    }

    await logActivityServer({
      action: 'CATFISH_HARVEST_LOGGED',
      entityType: 'CatfishHarvest',
      entityId: harvest.id,
      description: `Harvest logged for batch ${batch.batchCode}`,
      metadata: { batchId, quantityKg: newQty, fishCountHarvested, unitCostPerKg, closeBatch: !!closeBatch },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ harvest });
  } catch (error: any) {
    console.error('Catfish harvest create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
