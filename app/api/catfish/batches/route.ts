/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

const normalizeProductionType = (value: unknown): 'Fingerlings' | 'Juvenile' | 'Grow-out (Adult)' | null => {
  const input = String(value || '').trim();
  if (!input) return null;
  if (input === 'Juvenile') return 'Juvenile';
  if (input === 'Grow-out (Adult)' || input === 'Melange') return 'Grow-out (Adult)';
  if (input === 'Fingerlings') return 'Fingerlings';
  if (input === 'Hatchery') return null;
  if (input === 'Growout') return 'Grow-out (Adult)';
  if (input === 'Grow-out') return 'Grow-out (Adult)';
  return 'Fingerlings';
};

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
    const requestedType = searchParams.get('productionType');
    const productionType = normalizeProductionType(requestedType);

    let query = admin
      .from('CatfishBatch')
      .select('*')
      .order('startDate', { ascending: false });

    if (productionType) {
      query = query.eq('productionType', productionType);
    }

    if (batchId) query = query.eq('id', batchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const batches = data || [];
    if (batches.length === 0) return NextResponse.json({ batches: [] });

    const batchIds = batches.map((row: any) => row.id);
    const [{ data: logs }, { data: sales }] = await Promise.all([
      admin.from('CatfishDailyLog').select('batchId, mortalityCount').in('batchId', batchIds),
      admin.from('CatfishSale').select('batchId, quantitySold').in('batchId', batchIds)
    ]);
    const { data: transfers } = await admin
      .from('CatfishTransfer')
      .select('fromBatchId, toBatchId, quantity, status')
      .or(`fromBatchId.in.(${batchIds.join(',')}),toBatchId.in.(${batchIds.join(',')})`);

    const mortalityByBatch = new Map<string, number>();
    (logs || []).forEach((row: any) => {
      mortalityByBatch.set(
        row.batchId,
        (mortalityByBatch.get(row.batchId) || 0) + Number(row.mortalityCount || 0)
      );
    });

    const soldByBatch = new Map<string, number>();
    (sales || []).forEach((row: any) => {
      soldByBatch.set(
        row.batchId,
        (soldByBatch.get(row.batchId) || 0) + Number(row.quantitySold || 0)
      );
    });

    const transferOutByBatch = new Map<string, number>();
    const transferInByBatch = new Map<string, number>();
    (transfers || []).forEach((row: any) => {
      if (row.status !== 'COMPLETED') return;
      const qty = Number(row.quantity || 0);
      if (row.fromBatchId) {
        transferOutByBatch.set(
          row.fromBatchId,
          (transferOutByBatch.get(row.fromBatchId) || 0) + qty
        );
      }
      if (row.toBatchId) {
        transferInByBatch.set(
          row.toBatchId,
          (transferInByBatch.get(row.toBatchId) || 0) + qty
        );
      }
    });

    const enriched = batches.map((batch: any) => {
      const initialStock = Number(batch.initialStock || 0);
      const mortalityTotal = Number(mortalityByBatch.get(batch.id) || 0);
      const totalSold = Number(soldByBatch.get(batch.id) || 0);
      const totalTransferredOut = Number(transferOutByBatch.get(batch.id) || 0);
      const totalTransferredIn = Number(transferInByBatch.get(batch.id) || 0);
      const currentPopulation = Math.max(0, initialStock - mortalityTotal - totalSold - totalTransferredOut + totalTransferredIn);
      return {
        ...batch,
        mortalityTotal,
        totalSold,
        totalTransferredOut,
        totalTransferredIn,
        currentPopulation,
      };
    });

    return NextResponse.json({ batches: enriched });
  } catch (error: any) {
    console.error('Catfish batch fetch error:', error);
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
    const batchName = String(body.batchName || '').trim();
    const productionType = normalizeProductionType(body.productionType) ?? 'Fingerlings';
    const initialStock = Math.floor(Number(body.initialStock || 0));
    const initialSeedCost = roundTo2(Number(body.initialSeedCost || 0));

    if (!batchName) {
      return NextResponse.json({ error: 'Batch name is required' }, { status: 400 });
    }
    if (initialStock <= 0) {
      return NextResponse.json({ error: 'Initial stock must be greater than zero' }, { status: 400 });
    }
    if (initialSeedCost < 0) {
      return NextResponse.json({ error: 'Initial seed cost cannot be negative' }, { status: 400 });
    }

    const admin = createAdminClient();
    const payload = {
      productionType,
      batchName,
      startDate: body.startDate ?? new Date().toISOString().split('T')[0],
      expectedHarvestDate: body.expectedHarvestDate ?? null,
      initialStock,
      initialSeedCost,
      parentBatchId: body.parentBatchId ?? null,
      transferCostBasis: body.transferCostBasis === undefined || body.transferCostBasis === null
        ? null
        : roundTo2(Number(body.transferCostBasis || 0)),
      status: body.status === 'Completed' ? 'Completed' : 'Active',
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await admin
      .from('CatfishBatch')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_BATCH_CREATED',
      entityType: 'CatfishBatch',
      entityId: data.id,
      description: `Catfish batch ${data.batchName} created`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ batch: data });
  } catch (error: any) {
    console.error('Catfish batch create error:', error);
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
    const { count: logCount } = await admin
      .from('CatfishDailyLog')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', id);
    if ((logCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete batch with daily logs.' }, { status: 400 });
    }

    const { count: saleCount } = await admin
      .from('CatfishSale')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', id);
    if ((saleCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete batch with sales.' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('CatfishBatch')
      .delete()
      .eq('id', id)
      .select('id, batchName')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_BATCH_DELETED',
      entityType: 'CatfishBatch',
      entityId: data.id,
      description: `Catfish batch ${data.batchName} deleted`,
      metadata: { id: data.id, batchName: data.batchName },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Catfish batch delete error:', error);
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
    const batchName = String(body.batchName || '').trim();
    const productionType = normalizeProductionType(body.productionType) ?? 'Fingerlings';
    const initialStock = Math.floor(Number(body.initialStock || 0));
    const initialSeedCost = roundTo2(Number(body.initialSeedCost || 0));

    if (!batchName) {
      return NextResponse.json({ error: 'Batch name is required' }, { status: 400 });
    }
    if (initialStock <= 0) {
      return NextResponse.json({ error: 'Initial stock must be greater than zero' }, { status: 400 });
    }
    if (initialSeedCost < 0) {
      return NextResponse.json({ error: 'Initial seed cost cannot be negative' }, { status: 400 });
    }

    const admin = createAdminClient();
    const payload = {
      productionType,
      batchName,
      startDate: body.startDate ?? new Date().toISOString().split('T')[0],
      expectedHarvestDate: body.expectedHarvestDate ?? null,
      initialStock,
      initialSeedCost,
      parentBatchId: body.parentBatchId ?? null,
      transferCostBasis: body.transferCostBasis === undefined || body.transferCostBasis === null
        ? null
        : roundTo2(Number(body.transferCostBasis || 0)),
      status: body.status === 'Completed' ? 'Completed' : 'Active',
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await admin
      .from('CatfishBatch')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_BATCH_UPDATED',
      entityType: 'CatfishBatch',
      entityId: data.id,
      description: `Catfish batch ${data.batchName} updated`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ batch: data });
  } catch (error: any) {
    console.error('Catfish batch update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
