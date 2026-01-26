import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';

export async function GET(request: NextRequest) {
 try {
  const { searchParams } = new URL(request.url);
  const module = searchParams.get('module');

 const admin = createAdminClient();
 let query = admin.from('Product').select('*').order('name');
 if (module && module !== 'ALL') {
  query = query.eq('module', module);
 }

 const { data, error } = await query;
 if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const products = data || [];
  if (products.length === 0) return NextResponse.json({ products: [] });

  const moduleCodes = module && module !== 'ALL' ? [module] : ['FEED_MILL', 'POULTRY', 'BSF', 'CATFISH'];
  const { data: locations } = await admin
   .from('InventoryLocation')
   .select('id, code')
   .in('code', moduleCodes);

  const locationByCode = new Map((locations || []).map(loc => [loc.code, loc.id]));
  const locationIds = (locations || []).map(loc => loc.id);

  let stockMap = new Map<string, { quantityOnHand: number; averageUnitCost: number }>();
  if (locationIds.length > 0) {
   const { data: stocks } = await admin
    .from('FinishedGoodsInventory')
    .select('productId, locationId, quantityOnHand, averageUnitCost')
    .in('locationId', locationIds)
    .in('productId', products.map(p => p.id));

   stockMap = new Map(
    (stocks || []).map((stock: any) => [
     `${stock.productId}:${stock.locationId}`,
     {
      quantityOnHand: Number(stock.quantityOnHand || 0),
      averageUnitCost: Number(stock.averageUnitCost || 0)
     }
    ])
   );
  }

  const enriched = products.map(product => {
   const locationId = locationByCode.get(product.module);
   const stock = locationId ? stockMap.get(`${product.id}:${locationId}`) : null;
   return {
    ...product,
    quantityOnHand: stock?.quantityOnHand ?? 0,
    averageUnitCost: stock?.averageUnitCost ?? 0
   };
  });

  return NextResponse.json({ products: enriched });
 } catch (error: any) {
  console.error('Products fetch error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, module, unit } = await request.json();
  if (!name || !module || !unit) {
   return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
   .from('Product')
   .insert({
    name,
    module,
    unit,
    active: true
   })
   .select('*')
   .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ product: data });
 } catch (error: any) {
  console.error('Product create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
