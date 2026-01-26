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
      .from('CatfishFeedLog')
      .select('*, batch:CatfishBatch(batchCode), feedProduct:Product(name, unit, unitSizeKg)')
      .order('date', { ascending: false });

    if (batchId) {
      query = query.eq('batchId', batchId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ feedLogs: data || [] });
  } catch (error: any) {
    console.error('Catfish feed log fetch error:', error);
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

    const { batchId, date, feedProductId, quantityKg } = await request.json();
    if (!batchId || !feedProductId || Number(quantityKg) <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: product, error: productError } = await admin
      .from('Product')
      .select('id, name, unit, unitSizeKg, module')
      .eq('id', feedProductId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Feed product not found' }, { status: 404 });
    }
    if (product.module !== 'FEED_MILL') {
      return NextResponse.json({ error: 'Feed must come from feed mill products' }, { status: 400 });
    }

    const { data: location, error: locationError } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'CATFISH')
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Catfish location not found' }, { status: 400 });
    }

    const { data: stock, error: stockError } = await admin
      .from('FinishedGoodsInventory')
      .select('quantityOnHand, averageUnitCost')
      .eq('productId', feedProductId)
      .eq('locationId', location.id)
      .single();

    if (stockError || !stock) {
      return NextResponse.json({ error: 'Feed stock not found' }, { status: 400 });
    }

    const quantityKgNum = roundTo2(Number(quantityKg));
    const unitSize = Number(product.unitSizeKg || 0);
    const feedUnits = product.unit === 'BAG' && unitSize > 0
      ? roundTo2(quantityKgNum / unitSize)
      : quantityKgNum;

    const availableUnits = roundTo2(Number(stock.quantityOnHand || 0));
    if (availableUnits < feedUnits) {
      return NextResponse.json({ error: 'Insufficient feed stock' }, { status: 400 });
    }

    const unitCostPerUnit = roundTo2(Number(stock.averageUnitCost || 0));
    const unitCostPerKg = product.unit === 'BAG' && unitSize > 0
      ? roundTo2(unitCostPerUnit / unitSize)
      : unitCostPerUnit;

    const totalCost = roundTo2(quantityKgNum * unitCostPerKg);

    const { data: log, error: logError } = await admin
      .from('CatfishFeedLog')
      .insert({
        batchId,
        date: date ?? new Date().toISOString().split('T')[0],
        feedProductId,
        quantityKg: quantityKgNum,
        unitCostAtTime: unitCostPerKg,
        totalCost
      })
      .select('*, batch:CatfishBatch(batchCode), feedProduct:Product(name)')
      .single();

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 400 });
    }

    const { error: ledgerError } = await admin
      .from('FinishedGoodsLedger')
      .insert({
        productId: feedProductId,
        locationId: location.id,
        type: 'USAGE',
        quantity: feedUnits,
        unitCostAtTime: unitCostPerUnit,
        referenceType: 'CATFISH_FEED_LOG',
        referenceId: log.id,
        createdBy: auth.userId
      });

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 400 });
    }

    const { error: stockUpdateError } = await admin
      .from('FinishedGoodsInventory')
      .update({
        quantityOnHand: roundTo2(availableUnits - feedUnits),
        updatedAt: new Date().toISOString()
      })
      .eq('productId', feedProductId)
      .eq('locationId', location.id);

    if (stockUpdateError) {
      return NextResponse.json({ error: stockUpdateError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'CATFISH_FEED_LOG_CREATED',
      entityType: 'CatfishFeedLog',
      entityId: log.id,
      description: `Feed logged for batch ${batchId}`,
      metadata: { batchId, feedProductId, quantityKg: quantityKgNum, totalCost },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ feedLog: log });
  } catch (error: any) {
    console.error('Catfish feed log create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
