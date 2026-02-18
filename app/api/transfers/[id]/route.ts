import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const normalizeRequestDate = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) return text;
  const dmyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'BSF_STAFF'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const { quantity, notes, requestDate } = await request.json();
  const roundedQty = roundTo2(Number(quantity));
  const normalizedRequestDate = normalizeRequestDate(requestDate);

  if (!roundedQty || roundedQty <= 0) {
   return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
  }
  if (!normalizedRequestDate) {
   return NextResponse.json({ error: 'Invalid requestDate' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestRow, error: requestError } = await admin
   .from('TransferRequest')
   .select('id, status, requestedBy')
   .eq('id', id)
   .single();

  if (requestError || !requestRow) {
   return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (requestRow.status !== 'PENDING') {
   return NextResponse.json({ error: 'Only pending requests can be edited' }, { status: 400 });
  }

  const { data: lineRow, error: lineError } = await admin
   .from('TransferRequestLine')
   .select('id')
   .eq('transferRequestId', id)
   .limit(1)
   .single();

  if (lineError || !lineRow) {
   return NextResponse.json({ error: 'Request line not found' }, { status: 404 });
  }

  const { error: updateRequestError } = await admin
   .from('TransferRequest')
   .update({
    notes: notes ?? null,
    requestDate: normalizedRequestDate,
    updatedAt: new Date().toISOString()
   })
   .eq('id', id);

  if (updateRequestError) {
   return NextResponse.json({ error: updateRequestError.message }, { status: 400 });
  }

  const { error: updateLineError } = await admin
   .from('TransferRequestLine')
   .update({
    quantityRequested: roundedQty
   })
   .eq('id', lineRow.id);

  if (updateLineError) {
   return NextResponse.json({ error: updateLineError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'TRANSFER_REQUEST_UPDATED',
   entityType: 'TransferRequest',
   entityId: id,
   description: 'Updated transfer request',
   metadata: { quantity: roundedQty, requestDate: normalizedRequestDate },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Transfer request update error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'BSF_STAFF'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: requestRow, error: requestError } = await admin
   .from('TransferRequest')
   .select('id, status')
   .eq('id', id)
   .single();

  if (requestError || !requestRow) {
   return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (requestRow.status !== 'PENDING') {
   return NextResponse.json({ error: 'Only pending requests can be deleted' }, { status: 400 });
  }

  const { error: deleteError } = await admin
   .from('TransferRequest')
   .delete()
   .eq('id', id);

  if (deleteError) {
   return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'TRANSFER_REQUEST_DELETED',
   entityType: 'TransferRequest',
   entityId: id,
   description: 'Deleted transfer request',
   metadata: {},
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Transfer request delete error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
