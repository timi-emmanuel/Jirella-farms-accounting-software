import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { quantityReceived, unitCost, notes } = await request.json();

  if (!id) return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  if (unitCost === undefined || Number(unitCost) < 0) {
   return NextResponse.json({ error: 'Unit cost is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestRow, error: fetchError } = await admin
   .from('ProcurementRequest')
   .select('*')
   .eq('id', id)
   .single();

  if (fetchError || !requestRow) {
   return NextResponse.json({ error: 'Store request not found' }, { status: 404 });
  }

  if (requestRow.status !== 'APPROVED') {
   return NextResponse.json({ error: 'Only approved requests can be received' }, { status: 400 });
  }

  const receivedQty = Number(quantityReceived);
  if (!receivedQty || receivedQty <= 0) {
   return NextResponse.json({ error: 'Invalid received quantity' }, { status: 400 });
  }

  const unitPrice = Number(unitCost);

  const { data: line, error: lineError } = await admin
   .from('ProcurementRequestLine')
   .select('*')
   .eq('procurementRequestId', id)
   .single();

  if (lineError || !line) {
   return NextResponse.json({ error: 'Request line not found' }, { status: 404 });
  }

  const { error: updateLineError } = await admin
   .from('ProcurementRequestLine')
   .update({
    quantityReceived: receivedQty,
    unitCostAtReceipt: unitPrice
   })
   .eq('id', line.id);

  if (updateLineError) {
   return NextResponse.json({ error: updateLineError.message }, { status: 400 });
  }

  const { error: receiveError } = await admin.rpc('receive_procurement_request', {
   p_request_id: id,
   p_received_by: auth.userId
  });

  if (receiveError) {
   return NextResponse.json({ error: receiveError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'PROCUREMENT_RECEIVED',
   entityType: 'ProcurementRequest',
   entityId: id,
   description: `Procurement received for request ${id}`,
   metadata: { quantity: receivedQty, unitCost: unitPrice, notes },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Store request receive error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
