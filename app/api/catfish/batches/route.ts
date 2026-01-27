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
    const batchId = searchParams.get('batchId') || searchParams.get('id');

    let query = admin
      .from('CatfishBatch')
      .select('*, pond:CatfishPond(*)')
      .order('startDate', { ascending: false });

    if (batchId) {
      query = query.eq('id', batchId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const batches = data || [];
    if (batches.length === 0) {
      return NextResponse.json({ batches });
    }

    const batchIds = batches.map((batch: any) => batch.id);
    const { data: mortalityRows, error: mortalityError } = await admin
      .from('CatfishMortalityLog')
      .select('batchId, deadCount')
      .in('batchId', batchIds);

    if (mortalityError) {
      return NextResponse.json({ error: mortalityError.message }, { status: 400 });
    }

    const { data: harvestRows, error: harvestError } = await admin
      .from('CatfishHarvest')
      .select('batchId, fishCountHarvested')
      .in('batchId', batchIds);

    if (harvestError) {
      return NextResponse.json({ error: harvestError.message }, { status: 400 });
    }

    const mortalityMap = new Map<string, number>();
    (mortalityRows || []).forEach((row: any) => {
      const current = mortalityMap.get(row.batchId) ?? 0;
      mortalityMap.set(row.batchId, current + Number(row.deadCount || 0));
    });

    const harvestedMap = new Map<string, number>();
    (harvestRows || []).forEach((row: any) => {
      if (row.fishCountHarvested === null || row.fishCountHarvested === undefined) return;
      const current = harvestedMap.get(row.batchId) ?? 0;
      harvestedMap.set(row.batchId, current + Number(row.fishCountHarvested || 0));
    });

    const enriched = batches.map((batch: any) => {
      const mortalityTotal = mortalityMap.get(batch.id) ?? 0;
      const harvestedCount = harvestedMap.get(batch.id) ?? 0;
      const fishesLeft = Math.max(
        0,
        Number(batch.initialFingerlingsCount || 0) - Number(mortalityTotal || 0) - Number(harvestedCount || 0)
      );
      return { ...batch, mortalityTotal, harvestedCount, fishesLeft };
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
    if (!body.batchCode || !body.pondId) {
      return NextResponse.json({ error: 'Batch code and pond are required' }, { status: 400 });
    }

    const fingerlings = Number(body.initialFingerlingsCount || 0);
    const unitCost = Number(body.fingerlingUnitCost || 0);
    const totalFingerlingCost = roundTo2(fingerlings * unitCost);

    const admin = createAdminClient();
    const { data: pond, error: pondError } = await admin
      .from('CatfishPond')
      .select('id, capacityFish')
      .eq('id', body.pondId)
      .single();

    if (pondError || !pond) {
      return NextResponse.json({ error: 'Pond not found' }, { status: 400 });
    }

    if (Number(pond.capacityFish || 0) > 0 && fingerlings > 0) {
      const { data: existingBatches, error: batchError } = await admin
        .from('CatfishBatch')
        .select('initialFingerlingsCount, status')
        .eq('pondId', body.pondId);

      if (batchError) {
        return NextResponse.json({ error: batchError.message }, { status: 400 });
      }

      const activeTotal = (existingBatches || [])
        .filter((batch: any) => batch.status !== 'CLOSED')
        .reduce((sum: number, batch: any) => sum + Number(batch.initialFingerlingsCount || 0), 0);

      const nextTotal = activeTotal + fingerlings;
      if (nextTotal > Number(pond.capacityFish || 0)) {
        return NextResponse.json(
          { error: `Pond capacity exceeded. Capacity: ${pond.capacityFish}, current: ${activeTotal}, new: ${fingerlings}.` },
          { status: 400 }
        );
      }
    }

    const payload = {
      batchCode: body.batchCode,
      pondId: body.pondId,
      startDate: body.startDate ?? new Date().toISOString().split('T')[0],
      initialFingerlingsCount: fingerlings,
      fingerlingUnitCost: roundTo2(unitCost),
      totalFingerlingCost,
      status: body.status ?? 'GROWING',
      notes: body.notes ?? null,
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await admin
      .from('CatfishBatch')
      .insert(payload)
      .select('*, pond:CatfishPond(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Batch code already exists. Use a different code.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'CATFISH_BATCH_CREATED',
      entityType: 'CatfishBatch',
      entityId: data.id,
      description: `Catfish batch ${data.batchCode} created`,
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
