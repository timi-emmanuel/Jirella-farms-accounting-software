import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('PoultryFlock')
      .select('*')
      .order('startDate', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ flocks: data || [] });
  } catch (error: any) {
    console.error('Poultry flocks fetch error:', error);
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

    const { name, breed, initialCount, startDate, status } = await request.json();
    const normalizedName = String(name ?? '').trim();
    const count = Number(initialCount);

    if (!normalizedName || !Number.isFinite(count) || count < 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from('PoultryFlock')
      .select('id')
      .ilike('name', normalizedName)
      .limit(1);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if ((existing || []).length > 0) {
      return NextResponse.json({ error: 'Flock name already exists. Use a unique flock name.' }, { status: 409 });
    }

    const { data, error } = await admin
      .from('PoultryFlock')
      .insert({
        name: normalizedName,
        breed: breed ?? null,
        initialCount: Math.round(count),
        currentCount: Math.round(count),
        startDate: startDate ?? new Date().toISOString().split('T')[0],
        status: status ?? 'ACTIVE'
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'POULTRY_FLOCK_CREATED',
      entityType: 'PoultryFlock',
      entityId: data.id,
      description: `Created flock ${data.name}`,
      metadata: { name: data.name, initialCount: data.initialCount },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ flock: data });
  } catch (error: any) {
    console.error('Poultry flock create error:', error);
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
    if (!id) return NextResponse.json({ error: 'Missing flock id' }, { status: 400 });

    const admin = createAdminClient();
    const { count: logCount } = await admin
      .from('PoultryDailyLog')
      .select('id', { count: 'exact', head: true })
      .eq('flockId', id);

    if ((logCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete flock with daily logs.' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('PoultryFlock')
      .delete()
      .eq('id', id)
      .select('id, name')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'POULTRY_FLOCK_DELETED',
      entityType: 'PoultryFlock',
      entityId: data.id,
      description: `Deleted flock ${data.name}`,
      metadata: { id: data.id, name: data.name },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Poultry flock delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
