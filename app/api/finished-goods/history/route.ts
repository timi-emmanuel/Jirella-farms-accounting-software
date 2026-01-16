import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const locationCode = searchParams.get('locationCode');

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    const admin = createAdminClient();
    let locationId: string | null = null;
    if (locationCode) {
      const { data: location } = await admin
        .from('InventoryLocation')
        .select('id')
        .eq('code', locationCode)
        .single();
      locationId = location?.id ?? null;
    }

    let query = admin
      .from('FinishedGoodsLedger')
      .select('id, productId, locationId, type, quantity, unitCostAtTime, referenceType, referenceId, createdBy, createdAt')
      .eq('productId', productId)
      .order('createdAt', { ascending: false });

    if (locationId) {
      query = query.eq('locationId', locationId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const userIds = Array.from(new Set((data || []).map((row: any) => row.createdBy).filter(Boolean)));
    let userMap = new Map<string, { email: string | null; role: string | null }>();
    if (userIds.length > 0) {
      const { data: users } = await admin
        .from('users')
        .select('id, email, role')
        .in('id', userIds);
      if (users) {
        userMap = new Map(users.map((u) => [u.id, { email: u.email ?? null, role: u.role ?? null }]));
      }
    }

    const enriched = (data || []).map((row: any) => ({
      ...row,
      createdByProfile: userMap.get(row.createdBy) ?? null
    }));

    return NextResponse.json({ history: enriched });
  } catch (error: any) {
    console.error('Finished goods history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
