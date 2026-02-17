import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';

const LOCATION_NAMES: Record<string, string> = {
 STORE: 'Store'
};

export async function GET() {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER', 'MANAGER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  let { data: location, error: locationError } = await admin
   .from('InventoryLocation')
   .select('id, code')
   .eq('code', 'STORE')
   .single();

  // Seed STORE location if missing so history can load on fresh DBs.
  if ((locationError || !location) && LOCATION_NAMES.STORE) {
   const { data: created, error: createError } = await admin
    .from('InventoryLocation')
    .insert({ code: 'STORE', name: LOCATION_NAMES.STORE })
    .select('id, code')
    .single();

   if (!createError && created) {
    location = created;
    locationError = null;
   }
  }

  if (locationError || !location) {
   return NextResponse.json({ error: 'Store location not found' }, { status: 404 });
  }

  const { data, error } = await admin
   .from('InventoryLedger')
   .select('id, type, direction, quantity, unitCost, datePurchased, referenceType, referenceId, notes, createdBy, createdAt, item:Ingredient(name, unit)')
   .eq('locationId', location.id)
   .order('createdAt', { ascending: false })
   .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ history: data || [] });
 } catch (error: any) {
  console.error('Store history fetch error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
