import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF'];

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
      .from('BsfBatchFeedLog')
      .select('*, batch:BsfLarvariumBatch(batchCode)')
      .order('date', { ascending: false });

    if (batchId) query = query.eq('batchId', batchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    console.error('BSF feed log fetch error:', error);
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
    if (!body.batchId) {
      return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
    }

    const pkcKg = roundTo2(Number(body.pkcKg || 0));
    const wasteKg = roundTo2(Number(body.poultryWasteKg || 0));
    if (pkcKg <= 0 && wasteKg <= 0) {
      return NextResponse.json({ error: 'Enter PKC or poultry waste usage' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: batch, error: batchError } = await admin
      .from('BsfLarvariumBatch')
      .select('id, batchCode')
      .eq('id', body.batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });

    const { data: ingredients } = await admin
      .from('Ingredient')
      .select('id, name')
      .in('name', ['PKC', 'Poultry Waste']);

    const ingredientMap = new Map((ingredients || []).map((item: any) => [item.name, item.id]));
    const pkcId = ingredientMap.get('PKC');
    const wasteId = ingredientMap.get('Poultry Waste');

    if (!pkcId || !wasteId) {
      return NextResponse.json({ error: 'Missing PKC or Poultry Waste ingredient' }, { status: 400 });
    }

    const { data: logRow, error: logError } = await admin
      .from('BsfBatchFeedLog')
      .insert({
        batchId: body.batchId,
        date: body.date ?? new Date().toISOString().split('T')[0],
        pkcKg,
        poultryWasteKg: wasteKg,
        poultryWasteCostOverride: body.poultryWasteCostOverride ?? null,
        notes: body.notes ?? null,
        createdBy: auth.userId
      })
      .select('*')
      .single();

    if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });

    const cleanup = async () => {
      await admin.from('BsfBatchFeedLog').delete().eq('id', logRow.id);
    };

    const { data: balances } = await admin
      .from('InventoryBalance')
      .select('itemId, averageUnitCost')
      .eq('locationId', location.id)
      .in('itemId', [pkcId, wasteId]);

    const balanceMap = new Map((balances || []).map((row: any) => [row.itemId, Number(row.averageUnitCost || 0)]));

    const applyMovement = async (itemId: string, qty: number, cost: number) => {
      const { error } = await admin.rpc('apply_inventory_movement', {
        p_item_id: itemId,
        p_location_id: location.id,
        p_type: 'USAGE',
        p_direction: 'OUT',
        p_quantity: qty,
        p_unit_cost: cost,
        p_reference_type: 'BSF_FEED_LOG',
        p_reference_id: batch.id,
        p_notes: logRow.notes,
        p_created_by: auth.userId
      });

      if (error) {
        await cleanup();
        return error;
      }
      return null;
    };

    if (pkcKg > 0) {
      const cost = balanceMap.get(pkcId) ?? 0;
      const err = await applyMovement(pkcId, pkcKg, cost);
      if (err) return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (wasteKg > 0) {
      const overrideCost = body.poultryWasteCostOverride;
      const cost = overrideCost !== undefined && overrideCost !== null
        ? Number(overrideCost)
        : (balanceMap.get(wasteId) ?? 0);
      const err = await applyMovement(wasteId, wasteKg, cost);
      if (err) return NextResponse.json({ error: err.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'BSF_FEED_LOG_CREATED',
      entityType: 'BsfBatchFeedLog',
      entityId: logRow.id,
      description: `BSF feed log recorded for batch ${batch.batchCode}`,
      metadata: { ...logRow, batchCode: batch.batchCode },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ log: logRow });
  } catch (error: any) {
    console.error('BSF feed log create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
