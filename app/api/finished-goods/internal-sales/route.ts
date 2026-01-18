import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const EDIT_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF'];
const VIEW_ROLES = ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'ACCOUNTANT'];

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { productId, quantityKg, unitPrice, boughtByUserId } = await request.json();
    const qtyKg = roundTo2(Number(quantityKg));
    const price = roundTo2(Number(unitPrice));

    if (!productId || !Number.isFinite(qtyKg) || qtyKg <= 0 || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: product, error: productError } = await admin
      .from('Product')
      .select('id, module')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (product.module !== 'FEED_MILL') {
      return NextResponse.json({ error: 'Only feed mill products can be sold to poultry' }, { status: 400 });
    }

    const { data: purchaseId, error } = await admin.rpc('handle_internal_feed_purchase', {
      p_product_id: productId,
      p_quantity_kg: qtyKg,
      p_unit_price: price,
      p_sold_by: auth.userId,
      p_bought_by: boughtByUserId ?? auth.userId
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'INTERNAL_FEED_SALE',
      entityType: 'FeedInternalPurchase',
      entityId: purchaseId,
      description: 'Internal feed sale to poultry',
      metadata: { productId, quantityKg: qtyKg, unitPrice: price },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ id: purchaseId });
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

    const admin = createAdminClient();
    let query = admin
      .from('FeedInternalPurchase')
      .select('*, product:Product(name, unit, unitSizeKg)')
      .order('purchaseDate', { ascending: false });

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
