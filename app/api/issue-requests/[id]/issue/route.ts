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

  const { quantityIssued, notes } = await request.json();

  const admin = createAdminClient();
  const { data: requestRow, error: fetchError } = await admin
   .from('IssueRequest')
   .select('*')
   .eq('id', id)
   .single();

  if (fetchError || !requestRow) {
   return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (requestRow.status !== 'APPROVED') {
   return NextResponse.json({ error: 'Only approved requests can be issued' }, { status: 400 });
  }

  const issuedQty = roundTo2(Number(quantityIssued ?? requestRow.quantity));
  if (!issuedQty || issuedQty <= 0) {
   return NextResponse.json({ error: 'Invalid issued quantity' }, { status: 400 });
  }

  const { data: item, error: itemError } = await admin
   .from('Ingredient')
   .select('id, name, currentStock, averageCost, usedInProduction')
   .eq('id', requestRow.itemId)
   .single();

  if (itemError || !item) {
   return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const currentStock = Number(item.currentStock || 0);
  if (currentStock < issuedQty) {
   return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 });
  }

  const unitCost = roundTo2(Number(item.averageCost || 0));
  const totalValue = roundTo2(issuedQty * unitCost);

  const { error: updateError } = await admin
   .from('Ingredient')
   .update({
    currentStock: roundTo2(currentStock - issuedQty),
    usedInProduction: roundTo2(Number(item.usedInProduction || 0) + issuedQty),
    updatedAt: new Date().toISOString()
   })
   .eq('id', item.id);

  if (updateError) {
   return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { error: ledgerError } = await admin.from('InventoryTransaction').insert({
   ingredientId: item.id,
   type: 'USAGE',
   quantity: issuedQty,
   unitPrice: unitCost,
   totalValue,
   reference: `ISSUE_REQUEST:${id}`,
   notes: notes ?? requestRow.notes ?? null,
   date: new Date().toISOString()
  });

  if (ledgerError) {
   return NextResponse.json({ error: ledgerError.message }, { status: 400 });
  }

  const { error: statusError } = await admin
   .from('IssueRequest')
   .update({
    status: 'ISSUED',
    issuedBy: auth.userId,
    issuedQuantity: issuedQty,
    updatedAt: new Date().toISOString()
   })
   .eq('id', id);

  if (statusError) {
   return NextResponse.json({ error: statusError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'ISSUE_REQUEST_ISSUED',
   entityType: 'IssueRequest',
   entityId: id,
   description: `Issued ${issuedQty}${requestRow.unit} of ${requestRow.itemName}`,
   metadata: { item: requestRow.itemName, qty: issuedQty },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Issue request issue error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
