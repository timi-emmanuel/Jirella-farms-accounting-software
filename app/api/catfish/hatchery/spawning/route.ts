/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

const normalizeStatus = (value: unknown): 'Incubating' | 'Completed' | 'Failed' => {
  if (value === 'Completed') return 'Completed';
  if (value === 'Failed') return 'Failed';
  return 'Incubating';
};

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishSpawningEvent')
      .select('*')
      .order('eventDate', { ascending: false })
      .order('createdAt', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    console.error('Catfish spawning fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const payload = {
      eventDate: body.eventDate || new Date().toISOString().split('T')[0],
      femalesStripped: Math.max(0, Math.floor(Number(body.femalesStripped || 0))),
      hormoneCost: roundTo2(Number(body.hormoneCost || 0)),
      maleFishCost: roundTo2(Number(body.maleFishCost || 0)),
      sacrificedMaleWeightKg: roundTo2(Number(body.sacrificedMaleWeightKg || 0)),
      status: normalizeStatus(body.status),
      notes: body.notes ?? null
    };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishSpawningEvent')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_HATCHERY_SPAWNING_CREATED',
      entityType: 'CatfishSpawningEvent',
      entityId: data.id,
      description: `Spawning event created (${payload.status})`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ event: data });
  } catch (error: any) {
    console.error('Catfish spawning create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing spawning event id' }, { status: 400 });

    const body = await request.json();
    const payload: Record<string, unknown> = {
      status: normalizeStatus(body.status)
    };

    if (body.eventDate !== undefined) payload.eventDate = body.eventDate;
    if (body.femalesStripped !== undefined) payload.femalesStripped = Math.max(0, Math.floor(Number(body.femalesStripped || 0)));
    if (body.hormoneCost !== undefined) payload.hormoneCost = roundTo2(Number(body.hormoneCost || 0));
    if (body.maleFishCost !== undefined) payload.maleFishCost = roundTo2(Number(body.maleFishCost || 0));
    if (body.sacrificedMaleWeightKg !== undefined) payload.sacrificedMaleWeightKg = roundTo2(Number(body.sacrificedMaleWeightKg || 0));
    if (body.notes !== undefined) payload.notes = body.notes;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishSpawningEvent')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_HATCHERY_SPAWNING_UPDATED',
      entityType: 'CatfishSpawningEvent',
      entityId: data.id,
      description: `Spawning event updated (${data.status})`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ event: data });
  } catch (error: any) {
    console.error('Catfish spawning update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
