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
      .from('CatfishBroodstockLog')
      .select('*')
      .order('logDate', { ascending: false })
      .order('createdAt', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    console.error('Catfish broodstock log fetch error:', error);
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
      logDate: body.logDate || new Date().toISOString().split('T')[0],
      feedBrand: String(body.feedBrand || '').trim() || 'Unknown',
      feedAmountKg: roundTo2(Number(body.feedAmountKg || 0)),
      feedUnitPrice: roundTo2(Number(body.feedUnitPrice || 0)),
      mortalityCount: Math.max(0, Math.floor(Number(body.mortalityCount || 0))),
      notes: body.notes ?? null
    };

    if (payload.feedAmountKg < 0 || payload.feedUnitPrice < 0) {
      return NextResponse.json({ error: 'Feed values cannot be negative' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishBroodstockLog')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_HATCHERY_BROODSTOCK_LOG_CREATED',
      entityType: 'CatfishBroodstockLog',
      entityId: data.id,
      description: `Broodstock log created for ${payload.logDate}`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ log: data });
  } catch (error: any) {
    console.error('Catfish broodstock log create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
