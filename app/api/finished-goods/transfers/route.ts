import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const REQUEST_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF'];
const VIEW_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF', 'FEED_MILL_STAFF', 'ACCOUNTANT'];

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, REQUEST_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { productId, quantityKg, notes } = await request.json();
    const qtyKg = roundTo2(Number(quantityKg));

    if (!productId || !Number.isFinite(qtyKg) || qtyKg <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: fromLocation } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'FEED_MILL')
      .single();

    const { data: toLocation } = await admin
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'POULTRY')
      .single();

    if (!fromLocation || !toLocation) {
      return NextResponse.json({ error: 'Invalid locations' }, { status: 400 });
    }

    const { data: product, error: productError } = await admin
      .from('Product')
      .select('id, name, unit, unitSizeKg, module')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (product.module !== 'FEED_MILL') {
      return NextResponse.json({ error: 'Only feed mill products can be requested' }, { status: 400 });
    }

    const unitSize = Number(product.unitSizeKg || 0);
    const quantityRequested = product.unit === 'BAG' && unitSize > 0
      ? roundTo2(qtyKg / unitSize)
      : qtyKg;

    if (quantityRequested <= 0) {
      return NextResponse.json({ error: 'Quantity is too small for the selected unit' }, { status: 400 });
    }

    const { data: requestRow, error: requestError } = await admin
      .from('FinishedGoodsTransferRequest')
      .insert({
        fromLocationId: fromLocation.id,
        toLocationId: toLocation.id,
        status: 'PENDING',
        requestedBy: auth.userId,
        notes: notes ?? null
      })
      .select('*')
      .single();

    if (requestError) {
      return NextResponse.json({ error: requestError.message }, { status: 400 });
    }

    const { error: lineError } = await admin
      .from('FinishedGoodsTransferLine')
      .insert({
        transferRequestId: requestRow.id,
        productId,
        quantityRequested
      });

    if (lineError) {
      return NextResponse.json({ error: lineError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'FINISHED_GOODS_TRANSFER_CREATED',
      entityType: 'FinishedGoodsTransferRequest',
      entityId: requestRow.id,
      description: `Feed transfer requested`,
      metadata: { productId, quantityKg: qtyKg, quantityRequested, unit: product.unit },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ request: requestRow });
  } catch (error: any) {
    console.error('Finished goods transfer create error:', error);
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

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('FinishedGoodsTransferRequest')
      .select('*, lines:FinishedGoodsTransferLine(*, product:Product(name, unit, unitSizeKg)), from:InventoryLocation!FinishedGoodsTransferRequest_fromLocationId_fkey(code), to:InventoryLocation!FinishedGoodsTransferRequest_toLocationId_fkey(code)')
      .order('createdAt', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const requesterIds = Array.from(new Set((data || []).map((request: any) => request.requestedBy).filter(Boolean)));
    let requesterMap = new Map<string, { email: string | null; role: string | null }>();
    if (requesterIds.length > 0) {
      const { data: profiles } = await admin
        .from('users')
        .select('id, email, role')
        .in('id', requesterIds);

      if (profiles) {
        requesterMap = new Map(profiles.map(profile => [
          profile.id,
          { email: profile.email ?? null, role: profile.role ?? null }
        ]));
      }
    }

    const enriched = (data || []).map((request: any) => ({
      ...request,
      requestedByProfile: requesterMap.get(request.requestedBy) ?? null
    }));

    return NextResponse.json({ requests: enriched });
  } catch (error: any) {
    console.error('Finished goods transfer fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
