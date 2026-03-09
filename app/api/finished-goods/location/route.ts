import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { createClient as createServerClient } from '@/lib/supabase/server';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'CATFISH_STAFF', 'BSF_STAFF', 'PROCUREMENT_MANAGER', 'ACCOUNTANT', 'STORE_KEEPER'];
type FinishedGoodsStockRow = {
  productId: string;
  quantityOnHand: number | string | null;
  averageUnitCost: number | string | null;
};
const LOCATION_NAMES: Record<string, string> = {
  FEED_MILL: 'Feed Mill',
  POULTRY: 'Poultry',
  BSF: 'BSF',
  CATFISH: 'Catfish Facility',
  CATFISH_HATCHERY: 'Catfish Hatchery',
  CATFISH_FINGERLINGS: 'Catfish Fingerlings',
  CATFISH_JUVENILE: 'Catfish Juvenile',
  CATFISH_GROWOUT: 'Catfish Grow-out'
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    // Fallback: allow authenticated users whose profile row is temporarily missing/out-of-sync.
    if (!auth) {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const moduleParam = searchParams.get('module');
    const onlyInStock = searchParams.get('onlyInStock') === 'true';

    if (!code) {
      return NextResponse.json({ error: 'Missing location code' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: locationData, error: locationError } = await admin
      .from('InventoryLocation')
      .select('id, code, name')
      .eq('code', code)
      .single();
    let location = locationData;

    // Self-heal common setup gaps where module location row is missing.
    if (locationError || !location) {
      const defaultName = LOCATION_NAMES[code];
      if (!defaultName) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }

      const { error: ensureError } = await admin
        .from('InventoryLocation')
        .upsert(
          { code, name: defaultName },
          { onConflict: 'code', ignoreDuplicates: false }
        );

      if (ensureError) {
        return NextResponse.json({ error: ensureError.message }, { status: 400 });
      }

      const ensured = await admin
        .from('InventoryLocation')
        .select('id, code, name')
        .eq('code', code)
        .single();

      if (ensured.error || !ensured.data) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      }

      location = ensured.data;
    }

    let productQuery = admin
      .from('Product')
      .select('id, name, unit, unitSizeKg, module')
      .order('name');

    if (moduleParam) {
      productQuery = productQuery.eq('module', moduleParam);
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
      ((stocks || []) as FinishedGoodsStockRow[]).map((stock) => [
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

    const items = onlyInStock
      ? enriched.filter((item) => Number(item.quantityOnHand || 0) > 0)
      : enriched;

    return NextResponse.json({ location, items });
  } catch (error: unknown) {
    console.error('Finished goods location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
