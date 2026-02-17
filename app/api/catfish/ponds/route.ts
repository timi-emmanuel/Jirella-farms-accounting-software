import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishPond')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ponds: data || [] });
  } catch (error: any) {
    console.error('Catfish ponds fetch error:', error);
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

    const { name, capacityFish, waterType, status } = await request.json();
    if (!name) return NextResponse.json({ error: 'Pond name is required' }, { status: 400 });

    const admin = createAdminClient();
    const payload = {
      name,
      capacityFish: Number(capacityFish || 0),
      waterType: waterType ?? 'EARTHEN',
      status: status ?? 'ACTIVE',
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await admin
      .from('CatfishPond')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_POND_CREATED',
      entityType: 'CatfishPond',
      entityId: data.id,
      description: `Catfish pond ${data.name} created`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ pond: data });
  } catch (error: any) {
    console.error('Catfish pond create error:', error);
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
    if (!id) return NextResponse.json({ error: 'Missing pond id' }, { status: 400 });

    const admin = createAdminClient();
    const { count: batchCount } = await admin
      .from('CatfishBatch')
      .select('id', { count: 'exact', head: true })
      .eq('pondId', id);

    if ((batchCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Cannot delete pond with batches. Delete the batches first.' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('CatfishPond')
      .delete()
      .eq('id', id)
      .select('id, name')
      .single();

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Cannot delete pond with batches. Delete the batches first.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'CATFISH_POND_DELETED',
      entityType: 'CatfishPond',
      entityId: data.id,
      description: `Catfish pond ${data.name} deleted`,
      metadata: { id: data.id, name: data.name },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Catfish pond delete error:', error);
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
    if (!id) return NextResponse.json({ error: 'Missing pond id' }, { status: 400 });

    const { name, capacityFish, waterType, status } = await request.json();
    if (!name) return NextResponse.json({ error: 'Pond name is required' }, { status: 400 });

    const admin = createAdminClient();
    const payload = {
      name,
      capacityFish: Number(capacityFish || 0),
      waterType: waterType ?? 'EARTHEN',
      status: status ?? 'ACTIVE',
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await admin
      .from('CatfishPond')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Pond name already exists. Use a different name.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'CATFISH_POND_UPDATED',
      entityType: 'CatfishPond',
      entityId: data.id,
      description: `Catfish pond ${data.name} updated`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ pond: data });
  } catch (error: any) {
    console.error('Catfish pond update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
