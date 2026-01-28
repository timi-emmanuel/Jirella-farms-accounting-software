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
