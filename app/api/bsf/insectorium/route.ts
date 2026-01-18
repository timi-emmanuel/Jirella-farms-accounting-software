import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

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
      mortalityRate: Number(body.mortalityRate || 0),
      notes: body.notes ?? null,
      createdBy: auth.userId,
      updatedAt: new Date().toISOString()
    };

    if (!payload.date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('BsfInsectoriumLog')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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
