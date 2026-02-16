import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json();

  const admin = createAdminClient();
  const { data: current, error: fetchError } = await admin
   .from('StoreRequest')
   .select('id, status')
   .eq('id', id)
   .single();

  if (fetchError || !current) {
   return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (current.status !== 'PENDING') {
   return NextResponse.json({ error: 'Only pending requests can be edited' }, { status: 400 });
  }

  const updatePayload: Record<string, any> = {};
  if (payload.itemName) updatePayload.itemName = payload.itemName;
  if (payload.quantity !== undefined) updatePayload.quantity = Number(payload.quantity);
  if (payload.unit) updatePayload.unit = payload.unit;
  if (payload.requestDate !== undefined) updatePayload.requestDate = payload.requestDate || null;
  if (payload.unitCost !== undefined) updatePayload.unitCost = payload.unitCost === null ? null : Number(payload.unitCost);
  if (payload.totalCost !== undefined) updatePayload.totalCost = payload.totalCost === null ? null : Number(payload.totalCost);
  if (payload.purpose !== undefined) updatePayload.purpose = payload.purpose;
  updatePayload.updatedAt = new Date().toISOString();

  if (Object.keys(updatePayload).length === 1) {
   return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await admin
   .from('StoreRequest')
   .update(updatePayload)
   .eq('id', id)
   .select('*')
   .single();

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'STORE_REQUEST_UPDATED',
   entityType: 'StoreRequest',
   entityId: id,
   description: `Updated store request ${id}`,
   metadata: updatePayload,
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ request: data });
 } catch (error: any) {
  console.error('Store request update error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
