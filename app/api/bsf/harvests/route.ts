import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF'];

const findProducts = async (admin: ReturnType<typeof createAdminClient>) => {
  const { data } = await admin
    .from('Product')
    .select('id, name')
    .eq('module', 'BSF')
    .in('name', ['Live Larvae', 'Frass']);

  const map = new Map((data || []).map((row: any) => [row.name, row.id]));
  return map;
};

const upsertInventory = async (
  admin: ReturnType<typeof createAdminClient>,
  productId: string,
  locationId: string,
  quantity: number,
  unitCost: number,
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
  const nextQty = roundTo2(currentQty + quantity);
  const nextAvg = nextQty > 0
    ? roundTo2(((currentQty * currentAvg) + (quantity * unitCost)) / nextQty)
    : unitCost;

  const { error: upsertError } = await admin
    .from('FinishedGoodsInventory')
    .upsert({
      productId,
      locationId,
      quantityOnHand: nextQty,
      averageUnitCost: nextAvg,
      updatedAt: new Date().toISOString()
    });

  if (upsertError) return upsertError;

  const { error: ledgerError } = await admin
    .from('FinishedGoodsLedger')
    .insert({
      productId,
      locationId,
      type: 'PRODUCTION_IN',
      quantity,
      unitCostAtTime: unitCost,
      referenceType,
      referenceId,
      createdBy
    });

  return ledgerError ?? null;
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
      .from('BsfHarvestYield')
      .select('*, batch:BsfLarvariumBatch(batchCode)')
      .order('createdAt', { ascending: false });

    if (batchId) query = query.eq('batchId', batchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const harvests = data || [];
    if (harvests.length === 0) {
      return NextResponse.json({ harvests: [] });
    }

    const batchIds = harvests.map((row: any) => row.batchId).filter(Boolean);
    const { data: runs } = await admin
      .from('BsfProcessingRun')
      .select('batchId, inputWeightKg, processType')
      .in('batchId', batchIds)
      .eq('processType', 'DRYING');

    const processedByBatch = new Map<string, number>();
    (runs || []).forEach((run: any) => {
      const current = processedByBatch.get(run.batchId) ?? 0;
      processedByBatch.set(run.batchId, roundTo2(current + Number(run.inputWeightKg || 0)));
    });

    const enriched = harvests.map((row: any) => {
      const processedWetKg = processedByBatch.get(row.batchId) ?? 0;
      const remainingWetKg = roundTo2(Number(row.wetLarvaeKg || 0) - processedWetKg);
      return {
        ...row,
        processedWetKg,
        remainingWetKg: remainingWetKg < 0 ? 0 : remainingWetKg
      };
    });

    return NextResponse.json({ harvests: enriched });
  } catch (error: any) {
    console.error('BSF harvest fetch error:', error);
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
    if (!batchId) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });

    const wetLarvaeKg = roundTo2(Number(body.wetLarvaeKg || 0));
    const frassKg = roundTo2(Number(body.frassKg || 0));
    const residueWasteKg = roundTo2(Number(body.residueWasteKg || 0));

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('BsfHarvestYield')
      .select('id')
      .eq('batchId', batchId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Harvest already recorded for batch' }, { status: 400 });
    }

    const { data: batch, error: batchError } = await admin
      .from('BsfLarvariumBatch')
      .select('id, batchCode')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });

    const { data: feedLedger } = await admin
      .from('InventoryLedger')
      .select('quantity, unitCost')
      .eq('locationId', location.id)
      .eq('referenceType', 'BSF_FEED_LOG')
      .eq('referenceId', batchId);

    const totalFeedCost = (feedLedger || []).reduce((sum: number, row: any) => {
      return sum + Number(row.quantity || 0) * Number(row.unitCost || 0);
    }, 0);

    const unitCostWet = wetLarvaeKg > 0 ? roundTo2(totalFeedCost / wetLarvaeKg) : 0;

    const { data: harvest, error } = await admin
      .from('BsfHarvestYield')
      .insert({
        batchId,
        wetLarvaeKg,
        frassKg,
        residueWasteKg,
        createdBy: auth.userId
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const productMap = await findProducts(admin);
    const wetId = productMap.get('Live Larvae');
    const frassId = productMap.get('Frass');

    if (!wetId || !frassId) {
      return NextResponse.json({ error: 'Missing BSF products (Live Larvae/Frass)' }, { status: 400 });
    }

    if (wetLarvaeKg > 0) {
      const err = await upsertInventory(admin, wetId, location.id, wetLarvaeKg, unitCostWet, 'BSF_HARVEST', harvest.id, auth.userId);
      if (err) return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (frassKg > 0) {
      const err = await upsertInventory(admin, frassId, location.id, frassKg, 0, 'BSF_HARVEST', harvest.id, auth.userId);
      if (err) return NextResponse.json({ error: err.message }, { status: 400 });
    }

    await admin
      .from('BsfLarvariumBatch')
      .update({ status: 'HARVESTED', harvestDate: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString() })
      .eq('id', batchId);

    await logActivityServer({
      action: 'BSF_HARVEST_RECORDED',
      entityType: 'BsfHarvestYield',
      entityId: harvest.id,
      description: `Harvest recorded for batch ${batch.batchCode}`,
      metadata: { ...harvest, batchCode: batch.batchCode },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ harvest });
  } catch (error: any) {
    console.error('BSF harvest create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
