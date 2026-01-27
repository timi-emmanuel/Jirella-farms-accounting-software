import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const EDIT_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF'];
const VIEW_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'CATFISH_STAFF', 'ACCOUNTANT'];

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { productId, quantityKg, unitPrice, boughtByUserId, targetModule } = await request.json();
    const qtyKg = roundTo2(Number(quantityKg));
    const price = roundTo2(Number(unitPrice));
    const moduleTarget = targetModule === 'CATFISH' ? 'CATFISH' : 'POULTRY';

    if (!productId || !Number.isFinite(qtyKg) || qtyKg <= 0 || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: product, error: productError } = await admin
      .from('Product')
      .select('id, module, unit, unitSizeKg')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (product.module !== 'FEED_MILL') {
      return NextResponse.json({ error: 'Only feed mill products can be sold internally' }, { status: 400 });
    }

    const { data: feedMillLocation, error: feedMillLocationError } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'FEED_MILL')
      .single();

    if (feedMillLocationError || !feedMillLocation) {
      return NextResponse.json({ error: 'Feed mill location not found' }, { status: 404 });
    }

    const { data: feedMillStock } = await admin
      .from('FinishedGoodsInventory')
      .select('averageUnitCost')
      .eq('productId', productId)
      .eq('locationId', feedMillLocation.id)
      .single();

    const unitSizeKg = Number(product.unitSizeKg || 0);
    const useUnitConversion = product.unit === 'BAG' && unitSizeKg > 0;
    const unitsSold = useUnitConversion ? roundTo2(qtyKg / unitSizeKg) : qtyKg;
    const unitSellingPrice = useUnitConversion ? roundTo2(price * unitSizeKg) : price;
    const unitCostAtSale = roundTo2(Number(feedMillStock?.averageUnitCost || 0));

    const rpcName = moduleTarget === 'CATFISH'
      ? 'handle_internal_feed_purchase_catfish'
      : 'handle_internal_feed_purchase';

    const { data: purchaseId, error } = await admin.rpc(rpcName, {
      p_product_id: productId,
      p_quantity_kg: qtyKg,
      p_unit_price: price,
      p_sold_by: auth.userId,
      p_bought_by: boughtByUserId ?? auth.userId
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const soldAt = new Date().toISOString().split('T')[0];
    const { data: saleRow, error: saleError } = await admin
      .from('Sale')
      .insert({
        productId,
        module: 'FEED_MILL',
        locationId: feedMillLocation.id,
        quantitySold: unitsSold,
        unitSellingPrice,
        unitCostAtSale,
        soldAt,
        soldBy: auth.userId,
        notes: `Internal sale to ${moduleTarget}`
      })
      .select('id')
      .single();

    if (saleError) {
      return NextResponse.json({ error: `Failed to log internal sale in Sales: ${saleError.message}` }, { status: 400 });
    }

    await logActivityServer({
      action: 'INTERNAL_FEED_SALE',
      entityType: 'FeedInternalPurchase',
      entityId: purchaseId,
      description: `Internal feed sale to ${moduleTarget}`,
      metadata: { productId, quantityKg: qtyKg, unitPrice: price, targetModule: moduleTarget },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ id: purchaseId, saleId: saleRow?.id ?? null });
  } catch (error: any) {
    console.error('Internal feed sale error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const targetModule = searchParams.get('targetModule');

    const admin = createAdminClient();
    let query = admin
      .from('FeedInternalPurchase')
      .select('*, product:Product(name, unit, unitSizeKg)')
      .order('purchaseDate', { ascending: false });

    if (targetModule === 'CATFISH' || targetModule === 'POULTRY') {
      const referenceType = targetModule === 'CATFISH'
        ? 'INTERNAL_FEED_PURCHASE_CATFISH'
        : 'INTERNAL_FEED_PURCHASE';
      const { data: refs } = await admin
        .from('FinishedGoodsLedger')
        .select('referenceId')
        .eq('referenceType', referenceType);

      const ids = (refs || [])
        .map((row: any) => row.referenceId)
        .filter((id: string | null) => !!id);

      if (ids.length === 0) {
        return NextResponse.json({ purchases: [] });
      }
      query = query.in('id', ids);
    }

    if (productId) {
      query = query.eq('productId', productId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ purchases: data || [] });
  } catch (error: any) {
    console.error('Internal feed sale fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
