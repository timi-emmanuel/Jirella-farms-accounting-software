import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const EDIT_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF'];
const VIEW_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF', 'ACCOUNTANT'];

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { flockId, quantitySold, unitSellingPrice, soldAt, notes } = await request.json();
    const qty = Math.floor(Number(quantitySold || 0));
    const price = roundTo2(Number(unitSellingPrice || 0));

    if (!flockId || qty <= 0 || price <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: flock, error: flockError } = await admin
      .from('PoultryFlock')
      .select('id, name, currentCount')
      .eq('id', flockId)
      .single();

    if (flockError || !flock) {
      return NextResponse.json({ error: 'Flock not found' }, { status: 404 });
    }

    const available = Number(flock.currentCount || 0);
    if (available < qty) {
      return NextResponse.json({ error: 'Insufficient birds in flock' }, { status: 400 });
    }

    const { data: location } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'POULTRY')
      .single();

    if (!location) {
      return NextResponse.json({ error: 'Poultry location not found' }, { status: 400 });
    }

    const { data: product, error: productError } = await admin
      .from('Product')
      .select('id')
      .eq('name', 'Live Birds')
      .single();

    let productId = product?.id;
    if (!productId) {
      const { data: createdProduct, error: createError } = await admin
        .from('Product')
        .insert({
          name: 'Live Birds',
          module: 'POULTRY',
          unit: 'BIRD',
          active: true
        })
        .select('id')
        .single();

      if (createError || !createdProduct) {
        return NextResponse.json({ error: createError?.message || 'Failed to create birds product' }, { status: 400 });
      }
      productId = createdProduct.id;
    }

    const { error: updateError } = await admin
      .from('PoultryFlock')
      .update({
        currentCount: Math.max(0, available - qty),
        updatedAt: new Date().toISOString()
      })
      .eq('id', flockId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const { data: sale, error: saleError } = await admin
      .from('Sale')
      .insert({
        productId,
        module: 'POULTRY',
        locationId: location.id,
        quantitySold: qty,
        unitSellingPrice: price,
        unitCostAtSale: 0,
        soldAt: soldAt ?? new Date().toISOString().split('T')[0],
        soldBy: auth.userId,
        notes: notes ? `Flock: ${flock.name}. ${notes}` : `Flock: ${flock.name}`
      })
      .select('id')
      .single();

    if (saleError) {
      return NextResponse.json({ error: saleError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'POULTRY_BIRD_SALE',
      entityType: 'Sale',
      entityId: sale.id,
      description: `Sold ${qty} birds from ${flock.name}`,
      metadata: { flockId, quantitySold: qty, unitPrice: price },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ saleId: sale.id });
  } catch (error: any) {
    console.error('Poultry bird sale error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Poultry bird sales fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
