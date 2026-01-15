import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'POULTRY_STAFF', 'FEED_MILL_STAFF'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');

    const admin = createAdminClient();
    let query = admin
      .from('Expense')
      .select('*')
      .order('spentAt', { ascending: false });

    if (module && module !== 'ALL') {
      query = query.eq('module', module);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ expenses: data || [] });
  } catch (error: any) {
    console.error('Expense fetch error:', error);
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

    const { module, category, amount, spentAt, notes } = await request.json();
    const value = roundTo2(Number(amount));

    if (!module || !category || !Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('Expense')
      .insert({
        module,
        category,
        amount: value,
        spentAt: spentAt ?? new Date().toISOString().split('T')[0],
        notes: notes ?? null,
        createdBy: auth.userId
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'EXPENSE_LOGGED',
      entityType: 'Expense',
      entityId: data.id,
      description: `Expense logged for ${module}`,
      metadata: { module, category, amount: value },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ expense: data });
  } catch (error: any) {
    console.error('Expense create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
