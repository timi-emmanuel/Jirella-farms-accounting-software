import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type BalanceRow = {
 itemId: string;
 quantityOnHand: number | null;
 averageUnitCost: number | null;
 lastPurchaseUnitCost: number | null;
 lastPurchaseDate: string | null;
 updatedAt: string | null;
};

type ItemRow = {
 id: string;
 name: string;
 description: string | null;
 unit: string;
};

const LOCATION_NAMES: Record<string, string> = {
 STORE: 'Store',
 FEED_MILL: 'Feed Mill',
 POULTRY: 'Poultry',
 BSF: 'BSF',
 CATFISH: 'Catfish',
};

export async function GET(request: NextRequest) {
 try {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim().toUpperCase();

  if (!code) {
   return NextResponse.json({ error: 'Missing location code' }, { status: 400 });
  }

  const admin = createAdminClient();
  let { data: location, error: locationError } = await admin
   .from('InventoryLocation')
   .select('id, code, name')
   .eq('code', code)
   .single();

  // Backfill known module locations if they have not been seeded yet.
  if ((locationError || !location) && LOCATION_NAMES[code]) {
   const { data: created, error: createError } = await admin
    .from('InventoryLocation')
    .insert({ code, name: LOCATION_NAMES[code] })
    .select('id, code, name')
    .single();

   if (!createError && created) {
    location = created;
    locationError = null;
   } else {
    const retry = await admin
     .from('InventoryLocation')
     .select('id, code, name')
     .eq('code', code)
     .single();
    location = retry.data;
    locationError = retry.error;
   }
  }

  if (locationError || !location) {
   return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }

  const { data: balances, error: balanceError } = await admin
   .from('InventoryBalance')
   .select('itemId, quantityOnHand, averageUnitCost, lastPurchaseUnitCost, lastPurchaseDate, updatedAt')
   .eq('locationId', location.id);

  if (balanceError) {
   return NextResponse.json({ error: balanceError.message }, { status: 400 });
  }

  let itemQuery = admin
   .from('Ingredient')
   .select('id, name, description, unit')
   .order('name');

  if (code === 'FEED_MILL') {
   itemQuery = itemQuery.eq('trackInFeedMill', true);
  }
  if (code === 'BSF') {
   itemQuery = itemQuery.in('name', ['PKC', 'Poultry Waste', 'Starter Mesh', 'Starter mesh']);
  }

  const { data: items, error: itemError } = await itemQuery;

  if (itemError) {
   return NextResponse.json({ error: itemError.message }, { status: 400 });
  }

  const balanceMap = new Map((balances as BalanceRow[] || []).map((b) => [b.itemId, b]));

  const enriched = ((items as ItemRow[]) || []).map((item) => {
   const balance = balanceMap.get(item.id);
   return {
    ...item,
    quantityOnHand: balance?.quantityOnHand ?? 0,
    averageUnitCost: balance?.averageUnitCost ?? 0,
    lastPurchaseUnitCost: balance?.lastPurchaseUnitCost ?? 0,
    lastPurchaseDate: balance?.lastPurchaseDate ?? null,
    updatedAt: balance?.updatedAt ?? null
   };
  });

  return NextResponse.json({ location, items: enriched });
 } catch (error: unknown) {
  console.error('Inventory location error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
