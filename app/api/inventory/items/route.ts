import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, unit, description, trackInFeedMill } = await request.json();
  if (!name || !unit) {
   return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
   .from('Ingredient')
   .insert({
    name,
    unit,
    description: description ?? null,
    trackInFeedMill: trackInFeedMill ?? true
   })
   .select('*')
   .single();

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'INVENTORY_ITEM_CREATED',
   entityType: 'Ingredient',
   entityId: data?.id,
   description: `Created inventory item ${name}`,
   metadata: { name, unit, trackInFeedMill: trackInFeedMill ?? true },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ item: data });
 } catch (error: any) {
  console.error('Inventory item create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
