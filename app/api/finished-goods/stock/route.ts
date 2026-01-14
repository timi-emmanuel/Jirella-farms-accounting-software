import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
 try {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  const locationCode = searchParams.get('location');

  if (!productId) {
   return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
  }

  const admin = createAdminClient();
  let query = admin
   .from('FinishedGoodsInventory')
   .select('*')
   .eq('productId', productId);

  if (locationCode) {
   const { data: location } = await admin
    .from('InventoryLocation')
    .select('id')
    .eq('code', locationCode)
    .single();
   if (location) {
    query = query.eq('locationId', location.id);
   }
  }

  const { data, error } = await query.single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ stock: data });
 } catch (error: any) {
  console.error('Finished goods stock error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
