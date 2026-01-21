import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = context.params;
  const { name, description, unit, trackInFeedMill } = await request.json();

  if (!id) {
   return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  }

  const updatePayload: Record<string, any> = {};
  if (name) updatePayload.name = name;
  if (description !== undefined) updatePayload.description = description;
  if (unit) updatePayload.unit = unit;
  if (trackInFeedMill !== undefined) updatePayload.trackInFeedMill = trackInFeedMill;

  if (Object.keys(updatePayload).length === 0) {
   return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
   .from('Ingredient')
   .update(updatePayload)
   .eq('id', id)
   .select('*')
   .single();

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'INVENTORY_ITEM_UPDATED',
   entityType: 'Ingredient',
   entityId: id,
   description: `Updated inventory item ${data?.name ?? id}`,
   metadata: updatePayload,
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ item: data });
 } catch (error: any) {
  console.error('Inventory item update error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pathname = new URL(request.url).pathname;
  const pathParts = pathname.split('/').filter(Boolean);
  const idFromPath = pathParts.length >= 4 ? pathParts[3] : null;
  const id = (context.params?.id ?? idFromPath)?.trim();
  if (!id) {
   return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
   .from('Ingredient')
   .delete()
   .eq('id', id)
   .select('id, name')
   .single();

  if (error) {
   if (error.code === '23503') {
    return NextResponse.json({ error: 'Item is in use. Clear related balances/transactions before deleting.' }, { status: 409 });
   }
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'INVENTORY_ITEM_DELETED',
   entityType: 'Ingredient',
   entityId: id,
   description: `Deleted inventory item ${data?.name ?? id}`,
   metadata: { itemId: id, name: data?.name ?? null },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Inventory item delete error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
