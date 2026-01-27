import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

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
    const batchId = searchParams.get('batchId');

    let query = admin
      .from('CatfishMortalityLog')
      .select('*, batch:CatfishBatch(batchCode)')
      .order('date', { ascending: false });

    if (batchId) {
      query = query.eq('batchId', batchId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ mortalities: data || [] });
  } catch (error: any) {
    console.error('Catfish mortality fetch error:', error);
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

    const { batchId, date, deadCount, cause } = await request.json();
    if (!batchId || Number(deadCount) <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const payload = {
      batchId,
      date: date ?? new Date().toISOString().split('T')[0],
      deadCount: Number(deadCount || 0),
      cause: cause ?? null
    };

    const { data, error } = await admin
      .from('CatfishMortalityLog')
      .insert(payload)
      .select('*, batch:CatfishBatch(batchCode)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_MORTALITY_LOGGED',
      entityType: 'CatfishMortalityLog',
      entityId: data.id,
      description: `Mortality logged for batch ${batchId}`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ mortality: data });
  } catch (error: any) {
    console.error('Catfish mortality create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
