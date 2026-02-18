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

  const { ingredientId, quantity, reference, notes, locationCode } = await request.json();

  if (!ingredientId || !quantity || quantity <= 0) {
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

  const { data: location, error: locationError } = await admin
   .from('InventoryLocation')
   .select('id, code')
   .eq('code', locationCode ?? 'STORE')
   .single();

  if (locationError || !location) {
   return NextResponse.json({ error: 'Location not found' }, { status: 400 });
  }

  const { error: movementError } = await admin.rpc('apply_inventory_movement', {
   p_item_id: ingredientId,
   p_location_id: location.id,
   p_type: 'USAGE',
   p_direction: 'OUT',
   p_quantity: qty,
   p_unit_cost: null,
   p_reference_type: reference ?? null,
   p_reference_id: null,
   p_notes: notes ?? null,
   p_created_by: auth.userId,
   p_purchase_date: null
  });

  if (movementError) {
   return NextResponse.json({ error: movementError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'INVENTORY_ISSUE',
   entityType: 'Ingredient',
   entityId: ingredientId,
   description: `Issued ${qty} from ${location.code}: ${item.name}`,
   metadata: { quantity: qty, reference, notes, location: location.code },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Inventory issue error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
