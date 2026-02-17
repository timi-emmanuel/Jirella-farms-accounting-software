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

  const { ingredientId, quantity, unitPrice, purchaseDate, reference, notes } = await request.json();

  if (!ingredientId || !quantity || quantity <= 0 || unitPrice === undefined || unitPrice < 0) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: item, error: fetchError } = await admin
   .from('Ingredient')
   .select('id, name')
   .eq('id', ingredientId)
   .single();

  if (fetchError || !item) {
   return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const qty = roundTo2(Number(quantity));
  const unitCost = roundTo2(Number(unitPrice));
  const normalizedPurchaseDate = purchaseDate ? String(purchaseDate) : new Date().toISOString().split('T')[0];
  if (Number.isNaN(new Date(normalizedPurchaseDate).getTime())) {
   return NextResponse.json({ error: 'Invalid purchase date' }, { status: 400 });
  }

  const { data: storeLocation, error: locationError } = await admin
   .from('InventoryLocation')
   .select('id')
   .eq('code', 'STORE')
   .single();

  if (locationError || !storeLocation) {
   return NextResponse.json({ error: 'Store location not found' }, { status: 400 });
  }

  const { error: movementError } = await admin.rpc('apply_inventory_movement', {
   p_item_id: ingredientId,
   p_location_id: storeLocation.id,
   p_type: 'RECEIPT',
   p_direction: 'IN',
   p_quantity: qty,
   p_unit_cost: unitCost,
   p_reference_type: reference ?? null,
   p_reference_id: null,
   p_notes: notes ?? null,
   p_created_by: auth.userId,
   p_purchase_date: normalizedPurchaseDate
  });

  if (movementError) {
   return NextResponse.json({ error: movementError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'INVENTORY_RECEIPT',
   entityType: 'Ingredient',
   entityId: ingredientId,
   description: `Received ${qty} into inventory: ${item.name}`,
   metadata: { quantity: qty, unitPrice: unitCost, purchaseDate: normalizedPurchaseDate, reference, notes, location: 'STORE' },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Inventory receive error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
