/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];
const HATCHERY_LOCATION_CODE = 'CATFISH_HATCHERY';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('CatfishBroodstockLog')
      .select('*')
      .order('logDate', { ascending: false })
      .order('createdAt', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    console.error('Catfish broodstock log fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const feedProductId = body.feedProductId || null;
    const payload = {
      logDate: body.logDate || new Date().toISOString().split('T')[0],
      feedBrand: String(body.feedBrand || '').trim() || 'Unknown',
      feedAmountKg: roundTo2(Number(body.feedAmountKg || 0)),
      feedUnitPrice: roundTo2(Number(body.feedUnitPrice || 0)),
      mortalityCount: Math.max(0, Math.floor(Number(body.mortalityCount || 0))),
      notes: body.notes ?? null
    };

    if (payload.feedAmountKg < 0 || payload.feedUnitPrice < 0) {
      return NextResponse.json({ error: 'Feed values cannot be negative' }, { status: 400 });
    }
    if (payload.feedAmountKg > 0 && !feedProductId) {
      return NextResponse.json(
        { error: 'Select a hatchery feed product from inventory before logging feed quantity.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    let ledgerLocationId: string | null = null;
    let ledgerUnits = 0;
    let ledgerUnitCost = 0;

    if (feedProductId && payload.feedAmountKg > 0) {
      const { data: product, error: productError } = await admin
        .from('Product')
        .select('id, name, unit, unitSizeKg, module')
        .eq('id', feedProductId)
        .single();

      if (productError || !product) {
        return NextResponse.json({ error: 'Feed product not found' }, { status: 404 });
      }
      if (product.module !== 'FEED_MILL') {
        return NextResponse.json({ error: 'Feed must come from feed mill products' }, { status: 400 });
      }

      const { data: location, error: locationError } = await admin
        .from('InventoryLocation')
        .select('id')
        .eq('code', HATCHERY_LOCATION_CODE)
        .single();

      if (locationError || !location) {
        return NextResponse.json({ error: 'Catfish hatchery inventory location not found' }, { status: 400 });
      }

      const { data: stock, error: stockError } = await admin
        .from('FinishedGoodsInventory')
        .select('quantityOnHand, averageUnitCost')
        .eq('productId', feedProductId)
        .eq('locationId', location.id)
        .single();

      if (stockError || !stock) {
        return NextResponse.json({ error: 'Hatchery feed stock not found' }, { status: 400 });
      }

      const unitSize = Number(product.unitSizeKg || 0);
      const feedUnits = product.unit === 'BAG' && unitSize > 0
        ? roundTo2(payload.feedAmountKg / unitSize)
        : payload.feedAmountKg;

      const availableUnits = roundTo2(Number(stock.quantityOnHand || 0));
      if (availableUnits < feedUnits) {
        return NextResponse.json({ error: 'Insufficient hatchery feed stock' }, { status: 400 });
      }

      const unitCostPerUnit = roundTo2(Number(stock.averageUnitCost || 0));
      payload.feedUnitPrice = product.unit === 'BAG' && unitSize > 0
        ? roundTo2(unitCostPerUnit / unitSize)
        : unitCostPerUnit;
      if (!String(body.feedBrand || '').trim()) payload.feedBrand = product.name;

      await admin
        .from('FinishedGoodsInventory')
        .update({
          quantityOnHand: roundTo2(availableUnits - feedUnits),
          updatedAt: new Date().toISOString()
        })
        .eq('productId', feedProductId)
        .eq('locationId', location.id);

      ledgerLocationId = location.id;
      ledgerUnits = feedUnits;
      ledgerUnitCost = unitCostPerUnit;
    }

    const { data, error } = await admin
      .from('CatfishBroodstockLog')
      .insert(payload)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (feedProductId && payload.feedAmountKg > 0 && ledgerLocationId) {
      await admin.from('FinishedGoodsLedger').insert({
        productId: feedProductId,
        locationId: ledgerLocationId,
        type: 'USAGE',
        quantity: ledgerUnits,
        unitCostAtTime: ledgerUnitCost,
        referenceType: 'CATFISH_HATCHERY_BROODSTOCK_LOG',
        referenceId: data.id,
        createdBy: auth.userId
      });
    }

    await logActivityServer({
      action: 'CATFISH_HATCHERY_BROODSTOCK_LOG_CREATED',
      entityType: 'CatfishBroodstockLog',
      entityId: data.id,
      description: `Broodstock log created for ${payload.logDate}`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ log: data });
  } catch (error: any) {
    console.error('Catfish broodstock log create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
