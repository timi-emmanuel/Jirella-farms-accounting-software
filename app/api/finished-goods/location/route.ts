import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'CATFISH_STAFF', 'ACCOUNTANT', 'STORE_KEEPER'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const module = searchParams.get('module');

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

    let productQuery = admin
      .from('Product')
      .select('id, name, unit, unitSizeKg, module')
      .order('name');

    if (module) {
      productQuery = productQuery.eq('module', module);
    }

    const { data: products, error: productError } = await productQuery;
    if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
    if (!products || products.length === 0) return NextResponse.json({ location, items: [] });

    const { data: stocks } = await admin
      .from('FinishedGoodsInventory')
      .select('productId, quantityOnHand, averageUnitCost')
      .eq('locationId', location.id)
      .in('productId', products.map((p) => p.id));

    const stockMap = new Map(
      (stocks || []).map((stock: any) => [
        stock.productId,
        {
          quantityOnHand: Number(stock.quantityOnHand || 0),
          averageUnitCost: Number(stock.averageUnitCost || 0)
        }
      ])
    );

    const enriched = products.map((product) => {
      const stock = stockMap.get(product.id);
      return {
        ...product,
        quantityOnHand: stock?.quantityOnHand ?? 0,
        averageUnitCost: stock?.averageUnitCost ?? 0
      };
    });

    return NextResponse.json({ location, items: enriched });
  } catch (error: any) {
    console.error('Finished goods location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
