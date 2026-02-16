import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

export async function GET() {
 try {
  const admin = createAdminClient();
  const { data, error } = await admin
   .from('StoreRequest')
   .select('*')
   .order('createdAt', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ requests: data || [] });
 } catch (error: any) {
  console.error('Store requests fetch error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { itemName, quantity, unit, requestDate, unitCost, totalCost, purpose } = await request.json();
  if (!itemName || !quantity || quantity <= 0) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const roundedQty = roundTo2(Number(quantity));
  const parsedUnitCost = Number(unitCost);
  const roundedUnitCost = Number.isFinite(parsedUnitCost) ? roundTo2(parsedUnitCost) : null;
  if (roundedUnitCost !== null && roundedUnitCost < 0) {
   return NextResponse.json({ error: 'Unit cost cannot be negative' }, { status: 400 });
  }
  const computedTotalCost = roundedUnitCost !== null ? roundTo2(roundedQty * roundedUnitCost) : null;
  const roundedTotalCost =
   totalCost !== undefined && totalCost !== null && Number.isFinite(Number(totalCost))
    ? roundTo2(Number(totalCost))
    : computedTotalCost;

  let effectiveDate: string | null = null;
  if (requestDate) {
   const parsed = new Date(requestDate);
   if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: 'Invalid request date' }, { status: 400 });
   }
   effectiveDate = requestDate;
  }

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
   .from('StoreRequest')
   .insert({
    itemId,
    itemName,
    quantity: roundedQty,
    unit: unit ?? 'KG',
    requestDate: effectiveDate,
    unitCost: roundedUnitCost,
    totalCost: roundedTotalCost,
    purpose: purpose ?? null,
    status: 'PENDING',
    requestedBy: auth.userId
   })
   .select('*')
   .single();

  if (requestError) {
   return NextResponse.json({ error: requestError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'STORE_REQUEST_CREATED',
   entityType: 'StoreRequest',
   entityId: requestRow?.id,
   description: `Store request created for ${itemName}`,
   metadata: {
    item: itemName,
    qty: roundedQty,
    unit: unit ?? 'KG',
    requestDate: effectiveDate,
    unitCost: roundedUnitCost,
    totalCost: roundedTotalCost,
    purpose
   },
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
