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

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || searchParams.get('id');

    let query = admin
      .from('BsfLarvariumBatch')
      .select('*')
      .order('startDate', { ascending: false });

    if (batchId) {
      query = query.eq('id', batchId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Batch code already exists. Use a different code.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ batches: data || [] });
  } catch (error: any) {
    console.error('BSF batch fetch error:', error);
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
    if (!body.batchCode || !body.startDate) {
      return NextResponse.json({ error: 'Batch code and start date are required' }, { status: 400 });
    }
    const eggsGramsUsed = roundTo2(Number(body.eggsGramsUsed || 0));
    if (eggsGramsUsed <= 0) {
      return NextResponse.json({ error: 'Eggs grams used is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) {
      return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });
    }

    const { data: eggsProduct } = await admin
      .from('Product')
      .select('id')
      .eq('name', 'BSF Eggs')
      .eq('module', 'BSF')
      .single();

    if (!eggsProduct) {
      return NextResponse.json({ error: 'BSF Eggs product not found' }, { status: 400 });
    }

    const { data: eggStock } = await admin
      .from('FinishedGoodsInventory')
      .select('quantityOnHand, averageUnitCost')
      .eq('productId', eggsProduct.id)
      .eq('locationId', location.id)
      .single();

    const availableEggs = roundTo2(Number(eggStock?.quantityOnHand || 0));
    if (availableEggs < eggsGramsUsed) {
      return NextResponse.json({ error: 'Insufficient eggs to start batch.' }, { status: 400 });
    }

    const payload = {
      batchCode: body.batchCode,
      startDate: body.startDate,
      eggsGramsUsed,
      initialLarvaeWeightGrams: Number(body.initialLarvaeWeightGrams || 0),
      substrateMixRatio: body.substrateMixRatio ?? null,
      status: body.status ?? 'GROWING',
      notes: body.notes ?? null,
      createdBy: auth.userId,
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await admin
      .from('BsfLarvariumBatch')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const cleanup = async () => {
      await admin.from('BsfLarvariumBatch').delete().eq('id', data.id);
    };

    const nextEggs = roundTo2(availableEggs - eggsGramsUsed);
    const { error: stockError } = await admin
      .from('FinishedGoodsInventory')
      .update({
        quantityOnHand: nextEggs,
        updatedAt: new Date().toISOString()
      })
      .eq('productId', eggsProduct.id)
      .eq('locationId', location.id);

    if (stockError) {
      await cleanup();
      return NextResponse.json({ error: stockError.message }, { status: 400 });
    }

    const { error: ledgerError } = await admin
      .from('FinishedGoodsLedger')
      .insert({
        productId: eggsProduct.id,
        locationId: location.id,
        type: 'USAGE',
        quantity: eggsGramsUsed,
        unitCostAtTime: Number(eggStock?.averageUnitCost || 0),
        referenceType: 'BSF_BATCH_START',
        referenceId: data.id,
        createdBy: auth.userId
      });

    if (ledgerError) {
      await admin
        .from('FinishedGoodsInventory')
        .update({
          quantityOnHand: availableEggs,
          updatedAt: new Date().toISOString()
        })
        .eq('productId', eggsProduct.id)
        .eq('locationId', location.id);
      await cleanup();
      return NextResponse.json({ error: ledgerError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'BSF_BATCH_CREATED',
      entityType: 'BsfLarvariumBatch',
      entityId: data.id,
      description: `BSF batch ${data.batchCode} created`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ batch: data });
  } catch (error: any) {
    console.error('BSF batch create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing batch id' }, { status: 400 });

    const admin = createAdminClient();
    const { data: batch, error: batchError } = await admin
      .from('BsfLarvariumBatch')
      .select('*')
      .eq('id', id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const { count: feedCount } = await admin
      .from('BsfBatchFeedLog')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', id);

    if ((feedCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete batch with feed logs.' }, { status: 400 });
    }

    const { count: harvestCount } = await admin
      .from('BsfHarvestYield')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', id);

    if ((harvestCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete batch with harvest records.' }, { status: 400 });
    }

    const { count: processingCount } = await admin
      .from('BsfProcessingRun')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', id);

    if ((processingCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete batch with processing records.' }, { status: 400 });
    }

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) {
      return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });
    }

    const { data: eggsProduct } = await admin
      .from('Product')
      .select('id')
      .eq('name', 'BSF Eggs')
      .eq('module', 'BSF')
      .single();

    if (!eggsProduct) {
      return NextResponse.json({ error: 'BSF Eggs product not found' }, { status: 400 });
    }

    const { data: stock } = await admin
      .from('FinishedGoodsInventory')
      .select('quantityOnHand')
      .eq('productId', eggsProduct.id)
      .eq('locationId', location.id)
      .single();

    const currentQty = Number(stock?.quantityOnHand || 0);
    const eggsToRestore = roundTo2(Number(batch.eggsGramsUsed || 0));
    const nextQty = roundTo2(currentQty + eggsToRestore);

    const { error: updateError } = await admin
      .from('FinishedGoodsInventory')
      .update({
        quantityOnHand: nextQty,
        updatedAt: new Date().toISOString()
      })
      .eq('productId', eggsProduct.id)
      .eq('locationId', location.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    const { error: ledgerError } = await admin
      .from('FinishedGoodsLedger')
      .insert({
        productId: eggsProduct.id,
        locationId: location.id,
        type: 'ADJUSTMENT',
        quantity: eggsToRestore,
        unitCostAtTime: 0,
        referenceType: 'BSF_BATCH_DELETE',
        referenceId: id,
        createdBy: auth.userId
      });

    if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 400 });

    const { error: deleteError } = await admin
      .from('BsfLarvariumBatch')
      .delete()
      .eq('id', id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    await logActivityServer({
      action: 'BSF_BATCH_DELETED',
      entityType: 'BsfLarvariumBatch',
      entityId: id,
      description: `BSF batch ${batch.batchCode} deleted`,
      metadata: { id, batchCode: batch.batchCode },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BSF batch delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing batch id' }, { status: 400 });

    const body = await request.json();
    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (body.batchCode !== undefined) payload.batchCode = body.batchCode;
    if (body.startDate !== undefined) payload.startDate = body.startDate;
    if (body.initialLarvaeWeightGrams !== undefined) {
      payload.initialLarvaeWeightGrams = Number(body.initialLarvaeWeightGrams || 0);
    }
    if (body.substrateMixRatio !== undefined) payload.substrateMixRatio = body.substrateMixRatio || null;
    if (body.status !== undefined) payload.status = body.status;
    if (body.harvestDate !== undefined) payload.harvestDate = body.harvestDate || null;
    if (body.notes !== undefined) payload.notes = body.notes || null;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('BsfLarvariumBatch')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Batch code already exists. Use a different code.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'BSF_BATCH_UPDATED',
      entityType: 'BsfLarvariumBatch',
      entityId: id,
      description: `BSF batch ${data.batchCode} updated`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ batch: data });
  } catch (error: any) {
    console.error('BSF batch update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
