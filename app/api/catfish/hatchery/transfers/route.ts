/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishFryTransfer')
      .select('*, spawningEvent:CatfishSpawningEvent!CatfishFryTransfer_spawningEventId_fkey(*), toBatch:CatfishBatch!CatfishFryTransfer_toBatchId_fkey(id, batchName, productionType)')
      .order('transferDate', { ascending: false })
      .order('createdAt', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ transfers: data || [] });
  } catch (error: any) {
    console.error('Catfish hatchery transfer fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const spawningEventId = String(body.spawningEventId || '').trim();
    const transferDate = body.transferDate || new Date().toISOString().split('T')[0];
    const liveFryCount = Math.max(0, Math.floor(Number(body.liveFryCount || 0)));
    const internalPricePerFry = roundTo2(Number(body.internalPricePerFry || 0));
    const sacrificedMaleMeatPrice = roundTo2(Number(body.sacrificedMaleMeatPrice || 0));
    const notes = body.notes ?? null;

    if (!spawningEventId) return NextResponse.json({ error: 'Spawning event is required' }, { status: 400 });
    if (liveFryCount <= 0) return NextResponse.json({ error: 'Live fry count must be greater than zero' }, { status: 400 });
    if (internalPricePerFry < 0 || sacrificedMaleMeatPrice < 0) {
      return NextResponse.json({ error: 'Prices cannot be negative' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: event, error: eventError } = await admin
      .from('CatfishSpawningEvent')
      .select('id, status, sacrificedMaleWeightKg')
      .eq('id', spawningEventId)
      .single();

    if (eventError || !event) return NextResponse.json({ error: 'Spawning event not found' }, { status: 404 });
    if (event.status === 'Failed') {
      return NextResponse.json({ error: 'Cannot transfer fry from a failed spawning event' }, { status: 400 });
    }

    const payload = {
      spawningEventId,
      transferDate,
      liveFryCount,
      internalPricePerFry,
      sacrificedMaleWeightKg: roundTo2(Number(event.sacrificedMaleWeightKg || 0)),
      sacrificedMaleMeatPrice,
      notes
    };

    const { data: inserted, error: transferError } = await admin
      .from('CatfishFryTransfer')
      .insert(payload)
      .select('id')
      .single();

    if (transferError) {
      const isDuplicate = transferError.code === '23505';
      return NextResponse.json(
        { error: isDuplicate ? 'A fry transfer already exists for this spawning event' : transferError.message },
        { status: 400 }
      );
    }

    // Mark spawning event completed after successful transfer (idempotent behavior)
    await admin
      .from('CatfishSpawningEvent')
      .update({ status: 'Completed' })
      .eq('id', spawningEventId)
      .neq('status', 'Completed');

    const { data, error: fetchError } = await admin
      .from('CatfishFryTransfer')
      .select('*, spawningEvent:CatfishSpawningEvent!CatfishFryTransfer_spawningEventId_fkey(*), toBatch:CatfishBatch!CatfishFryTransfer_toBatchId_fkey(id, batchName, productionType)')
      .eq('id', inserted.id)
      .single();

    if (fetchError || !data) return NextResponse.json({ error: fetchError?.message || 'Transfer created but could not be fetched' }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_HATCHERY_TRANSFER_CREATED',
      entityType: 'CatfishFryTransfer',
      entityId: data.id,
      description: `Fry transfer recorded and fingerlings batch created`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ transfer: data });
  } catch (error: any) {
    console.error('Catfish hatchery transfer create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
