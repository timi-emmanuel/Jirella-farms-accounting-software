import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
 try {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
   return NextResponse.json({ error: 'Missing location code' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: location, error: locationError } = await admin
   .from('InventoryLocation')
   .select('id, code, name')
   .eq('code', code)
   .single();

  if (locationError || !location) {
   return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }

  const { data: balances, error: balanceError } = await admin
   .from('InventoryBalance')
   .select('itemId, quantityOnHand, averageUnitCost, updatedAt')
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

  const { data: items, error: itemError } = await itemQuery;

  if (itemError) {
   return NextResponse.json({ error: itemError.message }, { status: 400 });
  }

  const balanceMap = new Map(
   (balances || []).map((b: any) => [b.itemId, b])
  );

  const enriched = (items || []).map((item: any) => {
   const balance = balanceMap.get(item.id);
   return {
    ...item,
    quantityOnHand: balance?.quantityOnHand ?? 0,
    averageUnitCost: balance?.averageUnitCost ?? 0,
    updatedAt: balance?.updatedAt ?? null
   };
  });

  return NextResponse.json({ location, items: enriched });
 } catch (error: any) {
  console.error('Inventory location error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
