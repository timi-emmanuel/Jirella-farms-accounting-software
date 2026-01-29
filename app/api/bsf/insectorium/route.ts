import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'BSF_STAFF'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('BsfInsectoriumLog')
      .select('*')
      .order('date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    console.error('BSF insectorium fetch error:', error);
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
    const payload = {
      date: body.date,
      pupaeLoadedKg: Number(body.pupaeLoadedKg || 0),
      eggsHarvestedGrams: Number(body.eggsHarvestedGrams || 0),
      pupaeShellsHarvestedKg: Number(body.pupaeShellsHarvestedKg || 0),
      deadFlyKg: Number(body.deadFlyKg || 0),
      notes: body.notes ?? null,
      createdBy: auth.userId,
      updatedAt: new Date().toISOString()
    };

    if (!payload.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }
    if (payload.eggsHarvestedGrams <= 0) {
      return NextResponse.json({ error: 'Eggs harvested is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('BsfInsectoriumLog')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Entry already made for this date.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const cleanup = async () => {
      await admin.from('BsfInsectoriumLog').delete().eq('id', data.id);
    };

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) {
      await cleanup();
      return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });
    }

    const { data: products } = await admin
      .from('Product')
      .select('id, name')
      .eq('module', 'BSF')
      .in('name', ['BSF Eggs', 'Pupae Shells', 'Dead Fly']);

    const productMap = new Map((products || []).map((row: any) => [row.name, row.id]));
    const eggsId = productMap.get('BSF Eggs');
    const shellsId = productMap.get('Pupae Shells');
    const deadFlyId = productMap.get('Dead Fly');

    if (!eggsId || !shellsId || !deadFlyId) {
      await cleanup();
      return NextResponse.json({ error: 'Missing BSF eggs/shells/dead fly product setup' }, { status: 400 });
    }

    const upsertFinishedGoods = async (productId: string, quantity: number, unitCost: number) => {
      const { data: stock } = await admin
        .from('FinishedGoodsInventory')
        .select('quantityOnHand, averageUnitCost')
        .eq('productId', productId)
        .eq('locationId', location.id)
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
          locationId: location.id,
          quantityOnHand: nextQty,
          averageUnitCost: nextAvg,
          updatedAt: new Date().toISOString()
        });

      if (upsertError) return upsertError;

      const { error: ledgerError } = await admin
        .from('FinishedGoodsLedger')
        .insert({
          productId,
          locationId: location.id,
          type: 'PRODUCTION_IN',
          quantity,
          unitCostAtTime: unitCost,
          referenceType: 'BSF_INSECTORIUM_LOG',
          referenceId: data.id,
          createdBy: auth.userId
        });

      return ledgerError ?? null;
    };

    const eggsQty = roundTo2(payload.eggsHarvestedGrams);
    const shellsQty = roundTo2(payload.pupaeShellsHarvestedKg);
    const deadFlyQty = roundTo2(payload.deadFlyKg);

    const eggsErr = await upsertFinishedGoods(eggsId, eggsQty, 0);
    if (eggsErr) {
      await cleanup();
      return NextResponse.json({ error: eggsErr.message }, { status: 400 });
    }

    if (shellsQty > 0) {
      const shellsErr = await upsertFinishedGoods(shellsId, shellsQty, 0);
      if (shellsErr) {
        await cleanup();
        return NextResponse.json({ error: shellsErr.message }, { status: 400 });
      }
    }

    if (deadFlyQty > 0) {
      const deadErr = await upsertFinishedGoods(deadFlyId, deadFlyQty, 0);
      if (deadErr) {
        await cleanup();
        return NextResponse.json({ error: deadErr.message }, { status: 400 });
      }
    }

    await logActivityServer({
      action: 'BSF_INSECTORIUM_LOG_CREATED',
      entityType: 'BsfInsectoriumLog',
      entityId: data.id,
      description: 'BSF insectorium log recorded',
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ log: data });
  } catch (error: any) {
    console.error('BSF insectorium create error:', error);
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
    if (!id) return NextResponse.json({ error: 'Missing log id' }, { status: 400 });

    const admin = createAdminClient();
    const { data: log, error: logError } = await admin
      .from('BsfInsectoriumLog')
      .select('*')
      .eq('id', id)
      .single();

    if (logError || !log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'BSF')
      .single();

    if (!location) {
      return NextResponse.json({ error: 'BSF location not found' }, { status: 400 });
    }

    const { data: products } = await admin
      .from('Product')
      .select('id, name')
      .eq('module', 'BSF')
      .in('name', ['BSF Eggs', 'Pupae Shells', 'Dead Fly']);

    const productMap = new Map((products || []).map((row: any) => [row.name, row.id]));
    const eggsId = productMap.get('BSF Eggs');
    const shellsId = productMap.get('Pupae Shells');
    const deadFlyId = productMap.get('Dead Fly');

    if (!eggsId || !shellsId || !deadFlyId) {
      return NextResponse.json({ error: 'Missing BSF eggs/shells/dead fly product setup' }, { status: 400 });
    }

    const adjustInventory = async (productId: string, qty: number) => {
      const { data: stock } = await admin
        .from('FinishedGoodsInventory')
        .select('quantityOnHand')
        .eq('productId', productId)
        .eq('locationId', location.id)
        .single();

      const currentQty = Number(stock?.quantityOnHand || 0);
      if (currentQty < qty) {
        return { error: `Cannot delete log: insufficient stock to reverse ${qty}.` };
      }

      const nextQty = roundTo2(currentQty - qty);
      const { error: updateError } = await admin
        .from('FinishedGoodsInventory')
        .update({
          quantityOnHand: nextQty,
          updatedAt: new Date().toISOString()
        })
        .eq('productId', productId)
        .eq('locationId', location.id);

      if (updateError) {
        return { error: updateError.message };
      }

      const { error: ledgerError } = await admin
        .from('FinishedGoodsLedger')
        .insert({
          productId,
          locationId: location.id,
          type: 'ADJUSTMENT',
          quantity: -qty,
          unitCostAtTime: 0,
          referenceType: 'BSF_INSECTORIUM_LOG_DELETE',
          referenceId: id,
          createdBy: auth.userId
        });

      if (ledgerError) {
        return { error: ledgerError.message };
      }

      return { error: null };
    };

    const eggsQty = roundTo2(Number(log.eggsHarvestedGrams || 0));
    const shellsQty = roundTo2(Number(log.pupaeShellsHarvestedKg || 0));
    const deadFlyQty = roundTo2(Number(log.deadFlyKg || 0));

    if (eggsQty > 0) {
      const result = await adjustInventory(eggsId, eggsQty);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (shellsQty > 0) {
      const result = await adjustInventory(shellsId, shellsQty);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (deadFlyQty > 0) {
      const result = await adjustInventory(deadFlyId, deadFlyQty);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { error: deleteError } = await admin
      .from('BsfInsectoriumLog')
      .delete()
      .eq('id', id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    await logActivityServer({
      action: 'BSF_INSECTORIUM_LOG_DELETED',
      entityType: 'BsfInsectoriumLog',
      entityId: id,
      description: 'Deleted BSF insectorium log',
      metadata: { id },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('BSF insectorium delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
