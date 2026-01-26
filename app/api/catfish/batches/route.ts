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
    return NextResponse.json({ batches: data || [] });
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
    const payload = {
      batchCode: body.batchCode,
      pondId: body.pondId,
      startDate: body.startDate ?? new Date().toISOString().split('T')[0],
      initialFingerlingsCount: fingerlings,
      fingerlingUnitCost: roundTo2(unitCost),
      totalFingerlingCost,
      ageCategory: body.ageCategory ?? 'FRIES',
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
