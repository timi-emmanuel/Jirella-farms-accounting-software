import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF'];

const fetchProductMap = async (admin: ReturnType<typeof createAdminClient>) => {
  const { data } = await admin
    .from('Product')
    .select('id, name')
    .eq('module', 'BSF')
    .in('name', ['Wet Larvae', 'Dry Larvae', 'Larvae Oil', 'Larvae Cake']);

  return new Map((data || []).map((row: any) => [row.name, row.id]));
};

const updateStock = async (
  admin: ReturnType<typeof createAdminClient>,
  productId: string,
  locationId: string,
  quantityDelta: number,
  unitCost: number,
  ledgerType: 'USAGE' | 'PRODUCTION_IN',
  referenceType: string,
  referenceId: string,
  createdBy: string
) => {
  const { data: stock } = await admin
    .from('FinishedGoodsInventory')
    .select('quantityOnHand, averageUnitCost')
    .eq('productId', productId)
    .eq('locationId', locationId)
    .single();

  const currentQty = Number(stock?.quantityOnHand || 0);
  const currentAvg = Number(stock?.averageUnitCost || 0);

  if (ledgerType === 'USAGE' && currentQty < quantityDelta) {
    return { error: { message: 'Insufficient finished goods stock' } };
  }

  const nextQty = roundTo2(ledgerType === 'USAGE' ? currentQty - quantityDelta : currentQty + quantityDelta);
  const nextAvg = ledgerType === 'PRODUCTION_IN'
    ? (nextQty > 0 ? roundTo2(((currentQty * currentAvg) + (quantityDelta * unitCost)) / nextQty) : unitCost)
    : currentAvg;

  const { error: upsertError } = await admin
    .from('FinishedGoodsInventory')
    .upsert({
      productId,
      locationId,
      quantityOnHand: nextQty,
      averageUnitCost: nextAvg,
      updatedAt: new Date().toISOString()
    });

  if (upsertError) return { error: upsertError };

  const { error: ledgerError } = await admin
    .from('FinishedGoodsLedger')
    .insert({
      productId,
      locationId,
      type: ledgerType,
      quantity: quantityDelta,
      unitCostAtTime: unitCost,
      referenceType,
      referenceId,
      createdBy
    });

  return { error: ledgerError ?? null, averageUnitCost: currentAvg };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    const admin = createAdminClient();
    let query = admin
      .from('BsfProcessingRun')
      .select('*, batch:BsfLarvariumBatch(batchCode)')
      .order('runAt', { ascending: false });

    if (batchId) query = query.eq('batchId', batchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ runs: data || [] });
  } catch (error: any) {
    console.error('BSF processing fetch error:', error);
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
    const batchId = body.batchId as string | undefined;
    if (!batchId || !body.processType) {
      return NextResponse.json({ error: 'Batch and process type are required' }, { status: 400 });
    }

    const inputWeightKg = roundTo2(Number(body.inputWeightKg || 0));
    if (inputWeightKg <= 0) {
      return NextResponse.json({ error: 'Input weight must be greater than zero' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });

    const products = await fetchProductMap(admin);
    const wetId = products.get('Wet Larvae');
    const dryId = products.get('Dry Larvae');
    const oilId = products.get('Larvae Oil');
    const cakeId = products.get('Larvae Cake');

    if (!wetId || !dryId || !oilId || !cakeId) {
      return NextResponse.json({ error: 'Missing BSF product setup' }, { status: 400 });
    }

    const { data: batch, error: batchError } = await admin
      .from('BsfLarvariumBatch')
      .select('id, batchCode')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const runPayload = {
      batchId,
      processType: body.processType,
      inputWeightKg,
      outputDryLarvaeKg: roundTo2(Number(body.outputDryLarvaeKg || 0)),
      outputLarvaeOilLiters: roundTo2(Number(body.outputLarvaeOilLiters || 0)),
      outputLarvaeCakeKg: roundTo2(Number(body.outputLarvaeCakeKg || 0)),
      energyCostEstimate: body.energyCostEstimate ?? null,
      runAt: body.runAt ?? new Date().toISOString(),
      createdBy: auth.userId
    };

    const { data: run, error: runError } = await admin
      .from('BsfProcessingRun')
      .insert(runPayload)
      .select('*')
      .single();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 400 });

    if (body.processType === 'DRYING') {
      const { data: wetStock } = await admin
        .from('FinishedGoodsInventory')
        .select('averageUnitCost')
        .eq('productId', wetId)
        .eq('locationId', location.id)
        .single();

      const wetAvg = Number(wetStock?.averageUnitCost || 0);
      const usageResult = await updateStock(
        admin,
        wetId,
        location.id,
        inputWeightKg,
        wetAvg,
        'USAGE',
        'BSF_PROCESSING',
        run.id,
        auth.userId
      );

      if (usageResult.error) return NextResponse.json({ error: usageResult.error.message }, { status: 400 });
      const outputKg = runPayload.outputDryLarvaeKg;
      const unitCost = outputKg > 0 ? roundTo2((inputWeightKg * wetAvg) / outputKg) : 0;

      if (outputKg > 0) {
        const prodResult = await updateStock(
          admin,
          dryId,
          location.id,
          outputKg,
          unitCost,
          'PRODUCTION_IN',
          'BSF_PROCESSING',
          run.id,
          auth.userId
        );

        if (prodResult.error) return NextResponse.json({ error: prodResult.error.message }, { status: 400 });
      }
    }

    if (body.processType === 'PRESSING_EXTRACTION') {
      const { data: dryStock } = await admin
        .from('FinishedGoodsInventory')
        .select('averageUnitCost')
        .eq('productId', dryId)
        .eq('locationId', location.id)
        .single();

      const dryAvg = Number(dryStock?.averageUnitCost || 0);
      const usageResult = await updateStock(
        admin,
        dryId,
        location.id,
        inputWeightKg,
        dryAvg,
        'USAGE',
        'BSF_PROCESSING',
        run.id,
        auth.userId
      );

      if (usageResult.error) return NextResponse.json({ error: usageResult.error.message }, { status: 400 });
      const totalOutput = roundTo2(runPayload.outputLarvaeCakeKg + runPayload.outputLarvaeOilLiters);
      const unitCost = totalOutput > 0 ? roundTo2((inputWeightKg * dryAvg) / totalOutput) : 0;

      if (runPayload.outputLarvaeOilLiters > 0) {
        const prodOil = await updateStock(
          admin,
          oilId,
          location.id,
          runPayload.outputLarvaeOilLiters,
          unitCost,
          'PRODUCTION_IN',
          'BSF_PROCESSING',
          run.id,
          auth.userId
        );
        if (prodOil.error) return NextResponse.json({ error: prodOil.error.message }, { status: 400 });
      }

      if (runPayload.outputLarvaeCakeKg > 0) {
        const prodCake = await updateStock(
          admin,
          cakeId,
          location.id,
          runPayload.outputLarvaeCakeKg,
          unitCost,
          'PRODUCTION_IN',
          'BSF_PROCESSING',
          run.id,
          auth.userId
        );
        if (prodCake.error) return NextResponse.json({ error: prodCake.error.message }, { status: 400 });
      }
    }

    await admin
      .from('BsfLarvariumBatch')
      .update({ status: 'PROCESSED', updatedAt: new Date().toISOString() })
      .eq('id', batchId);

    await logActivityServer({
      action: 'BSF_PROCESSING_RECORDED',
      entityType: 'BsfProcessingRun',
      entityId: run.id,
      description: `BSF processing run recorded for batch ${batch.batchCode}`,
      metadata: runPayload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ run });
  } catch (error: any) {
    console.error('BSF processing create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
