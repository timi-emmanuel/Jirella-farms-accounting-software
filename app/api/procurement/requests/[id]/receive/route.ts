import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!id) {
   return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  }
  const { quantityReceived, unitCost, notes } = await request.json();

  if (!quantityReceived || Number(quantityReceived) <= 0 || unitCost === undefined || Number(unitCost) < 0) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const roundedQty = roundTo2(Number(quantityReceived));
  const roundedCost = roundTo2(Number(unitCost));

  const admin = createAdminClient();
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
    quantityReceived: roundedQty,
    unitCostAtReceipt: roundedCost
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
   metadata: { quantity: roundedQty, unitCost: roundedCost, notes },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Procurement receive error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
