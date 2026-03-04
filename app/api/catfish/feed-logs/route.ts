/* eslint-disable @typescript-eslint/no-explicit-any */
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
      .from('CatfishDailyLog')
      .select('*, batch:CatfishBatch(batchName), feedProduct:Product(name, unit, unitSizeKg)')
      .order('logDate', { ascending: false });

    if (batchId) query = query.eq('batchId', batchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ feedLogs: data || [] });
  } catch (error: any) {
    console.error('Catfish daily log fetch error:', error);
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

    const body = await request.json();
    const batchId = body.batchId;
    const date = body.logDate || body.date || new Date().toISOString().split('T')[0];
    const feedProductId = body.feedProductId || null;
    const feedBrandInput = String(body.feedBrand || '').trim();
    const feedAmountKg = roundTo2(Number(body.feedAmountKg ?? body.quantityKg ?? 0));
    const feedUnitPriceInput = roundTo2(Number(body.feedUnitPrice ?? body.unitCostAtTime ?? 0));
    const mortalityCount = Math.max(0, Math.floor(Number(body.mortalityCount || 0)));
    const abwGrams = body.abwGrams === null || body.abwGrams === undefined || body.abwGrams === ''
      ? null
      : roundTo2(Number(body.abwGrams));
    const averageLengthCm = body.averageLengthCm === null || body.averageLengthCm === undefined || body.averageLengthCm === ''
      ? null
      : roundTo2(Number(body.averageLengthCm));
    const notes = body.notes ?? null;

    if (!batchId) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
    if (feedAmountKg < 0) return NextResponse.json({ error: 'Feed amount cannot be negative' }, { status: 400 });
    if (feedUnitPriceInput < 0) return NextResponse.json({ error: 'Feed unit price cannot be negative' }, { status: 400 });
    if (mortalityCount < 0) return NextResponse.json({ error: 'Mortality cannot be negative' }, { status: 400 });
    if (feedAmountKg > 0 && !feedProductId) {
      return NextResponse.json(
        { error: 'Select a feed product from inventory before logging feed quantity.' },
        { status: 400 }
      );
    }
    if (
      feedAmountKg <= 0 &&
      mortalityCount <= 0 &&
      (abwGrams === null || abwGrams <= 0) &&
      (averageLengthCm === null || averageLengthCm <= 0) &&
      !notes
    ) {
      return NextResponse.json({ error: 'Log has no values to save' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { count: sameDayCount, error: duplicateError } = await admin
      .from('CatfishDailyLog')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', batchId)
      .eq('logDate', date);
    if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 400 });
    if ((sameDayCount || 0) > 0) {
      return NextResponse.json(
        { error: 'A daily log already exists for this batch on the selected date.' },
        { status: 400 }
      );
    }

    let resolvedFeedBrand = feedBrandInput;
    let resolvedUnitPrice = feedUnitPriceInput;
    let ledgerLocationId: string | null = null;
    let ledgerUnits = 0;
    let ledgerUnitCost = 0;

    if (feedProductId && feedAmountKg > 0) {
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

      const unitSize = Number(product.unitSizeKg || 0);
      const feedUnits = product.unit === 'BAG' && unitSize > 0
        ? roundTo2(feedAmountKg / unitSize)
        : feedAmountKg;

      const availableUnits = roundTo2(Number(stock.quantityOnHand || 0));
      if (availableUnits < feedUnits) {
        return NextResponse.json({ error: 'Insufficient feed stock' }, { status: 400 });
      }

      const unitCostPerUnit = roundTo2(Number(stock.averageUnitCost || 0));
      resolvedUnitPrice = product.unit === 'BAG' && unitSize > 0
        ? roundTo2(unitCostPerUnit / unitSize)
        : unitCostPerUnit;
      if (!resolvedFeedBrand) resolvedFeedBrand = product.name;

      await admin
        .from('FinishedGoodsInventory')
        .update({
          quantityOnHand: roundTo2(availableUnits - feedUnits),
          updatedAt: new Date().toISOString()
        })
        .eq('productId', feedProductId)
        .eq('locationId', location.id);

      ledgerLocationId = location.id;
      ledgerUnits = feedUnits;
      ledgerUnitCost = unitCostPerUnit;
    }

    const payload = {
      batchId,
      logDate: date,
      feedProductId,
      feedBrand: resolvedFeedBrand || 'Unknown',
      feedAmountKg,
      feedUnitPrice: resolvedUnitPrice,
      mortalityCount,
      abwGrams,
      averageLengthCm,
      notes
    };

    const { data: log, error: logError } = await admin
      .from('CatfishDailyLog')
      .insert(payload)
      .select('*, batch:CatfishBatch(batchName), feedProduct:Product(name)')
      .single();

    if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });

    if (feedProductId && feedAmountKg > 0 && ledgerLocationId) {
      await admin.from('FinishedGoodsLedger').insert({
        productId: feedProductId,
        locationId: ledgerLocationId,
        type: 'USAGE',
        quantity: ledgerUnits,
        unitCostAtTime: ledgerUnitCost,
        referenceType: 'CATFISH_DAILY_LOG',
        referenceId: log.id,
        createdBy: auth.userId
      });
    }

    await logActivityServer({
      action: 'CATFISH_DAILY_LOG_CREATED',
      entityType: 'CatfishDailyLog',
      entityId: log.id,
      description: `Daily log created for batch ${batchId}`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ feedLog: log });
  } catch (error: any) {
    console.error('Catfish daily log create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
