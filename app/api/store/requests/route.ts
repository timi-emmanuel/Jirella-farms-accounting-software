import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { itemName, quantity, unit, purpose } = await request.json();
  if (!itemName || !quantity || quantity <= 0) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const roundedQty = roundTo2(Number(quantity));

  const admin = createAdminClient();
  let itemId: string | null = null;

  const { data: existingItem } = await admin
   .from('Ingredient')
   .select('id')
   .eq('name', itemName)
   .single();

  if (existingItem) {
   itemId = existingItem.id;
  } else {
   const { data: createdItem, error: createError } = await admin
    .from('Ingredient')
    .insert({
     name: itemName,
     unit: unit ?? 'KG'
    })
    .select('id')
    .single();

   if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
   }
   itemId = createdItem.id;
  }

  const { data: requestRow, error: requestError } = await admin
   .from('ProcurementRequest')
   .insert({
    status: 'PENDING',
    createdBy: auth.userId,
    notes: purpose ?? null
   })
   .select('*')
   .single();

  if (requestError) {
   return NextResponse.json({ error: requestError.message }, { status: 400 });
  }

  const { error: lineError } = await admin
   .from('ProcurementRequestLine')
   .insert({
    procurementRequestId: requestRow.id,
    itemId,
    quantityRequested: roundedQty
   });

  if (lineError) {
   return NextResponse.json({ error: lineError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'PROCUREMENT_REQUEST_CREATED',
   entityType: 'ProcurementRequest',
   entityId: requestRow?.id,
   description: `Procurement requested for ${itemName}`,
   metadata: { item: itemName, qty: roundedQty, unit, purpose },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ request: requestRow });
 } catch (error: any) {
  console.error('Store request create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
