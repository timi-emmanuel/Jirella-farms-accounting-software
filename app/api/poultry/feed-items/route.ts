import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'POULTRY')
      .single();

    if (!location) {
      return NextResponse.json({ error: 'Poultry location not found' }, { status: 400 });
    }

    const { data: products, error: productError } = await admin
      .from('Product')
      .select('id, name, unit, unitSizeKg')
      .eq('module', 'FEED_MILL')
      .order('name');

    if (productError) {
      return NextResponse.json({ error: productError.message }, { status: 400 });
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ items: [] });
    }

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

    const available = enriched.filter((item) => Number(item.quantityOnHand || 0) > 0);

    return NextResponse.json({ items: available });
  } catch (error: any) {
    console.error('Poultry feed items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
