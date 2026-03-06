/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT'];
// TODO(next-step): support inter-module fish movement/sales (Fingerlings <-> Juvenile <-> Grow-out (Adult)) via transfer ledger.

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    const admin = createAdminClient();
    let query = admin
      .from('CatfishSale')
      .select('*, batch:CatfishBatch(batchName, status)')
      .order('saleDate', { ascending: false });

    if (batchId) query = query.eq('batchId', batchId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ sales: data || [] });
  } catch (error: any) {
    console.error('Catfish sales fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const batchId = body.batchId;
    const quantitySold = Math.max(0, Math.floor(Number(body.quantitySold || 0)));
    let unitPrice = roundTo2(Number(body.unitPrice || 0));
    const pricingMethod: 'CM' | 'KG' = String(body.pricingMethod || 'CM').toUpperCase() === 'KG' ? 'KG' : 'CM';
    const saleType = body.saleType === 'Final Clear-Out' ? 'Final Clear-Out' : 'Partial Offload';
    const saleDate = body.saleDate || new Date().toISOString().split('T')[0];
    const buyerDetails = body.buyerDetails ?? null;
    const saleLengthCmRaw = body.saleLengthCm === null || body.saleLengthCm === undefined || body.saleLengthCm === ''
      ? null
      : roundTo2(Number(body.saleLengthCm));
    const saleWeightKgRaw = body.saleWeightKg === null || body.saleWeightKg === undefined || body.saleWeightKg === ''
      ? null
      : roundTo2(Number(body.saleWeightKg));
    let sizeCategoryName: string | null = null;

    if (!batchId) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
    if (quantitySold <= 0) return NextResponse.json({ error: 'Quantity sold must be greater than zero' }, { status: 400 });
    if (saleLengthCmRaw !== null && saleLengthCmRaw < 0) {
      return NextResponse.json({ error: 'Sale length cannot be negative' }, { status: 400 });
    }
    if (saleWeightKgRaw !== null && saleWeightKgRaw < 0) {
      return NextResponse.json({ error: 'Sale weight cannot be negative' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: batch, error: batchError } = await admin
      .from('CatfishBatch')
      .select('id, productionType')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const autoPriceStage =
      batch.productionType === 'Fingerlings' ||
      batch.productionType === 'Juvenile' ||
      batch.productionType === 'Grow-out (Adult)';
    if (autoPriceStage && pricingMethod === 'CM') {
      if (saleLengthCmRaw === null) {
        return NextResponse.json({ error: 'Sale length (cm) is required for CM pricing' }, { status: 400 });
      }
      const { data: pricingRows, error: pricingError } = await admin
        .from('catfish_size_pricing')
        .select('name, price_per_piece')
        .eq('is_active', true)
        .eq('pricing_method', 'CM')
        .lte('min_cm', saleLengthCmRaw)
        .gt('max_cm', saleLengthCmRaw)
        .order('min_cm', { ascending: true })
        .limit(1);

      if (pricingError) return NextResponse.json({ error: pricingError.message }, { status: 400 });
      const matched = (pricingRows || [])[0];
      if (!matched) {
        return NextResponse.json({ error: 'No active CM pricing range found for the supplied length (cm).' }, { status: 400 });
      }

      sizeCategoryName = matched.name || null;
      unitPrice = roundTo2(Number(matched.price_per_piece || 0));
    }

    if (autoPriceStage && pricingMethod === 'KG') {
      if (saleWeightKgRaw === null || saleWeightKgRaw <= 0) {
        return NextResponse.json({ error: 'Sale weight (kg) is required for KG pricing' }, { status: 400 });
      }

      const { data: pricingRows, error: pricingError } = await admin
        .from('catfish_size_pricing')
        .select('name, price_per_kg')
        .eq('is_active', true)
        .eq('pricing_method', 'KG')
        .order('created_at', { ascending: false })
        .limit(1);

      if (pricingError) return NextResponse.json({ error: pricingError.message }, { status: 400 });
      const matched = (pricingRows || [])[0];
      if (!matched) {
        return NextResponse.json({ error: 'No active KG pricing row found in settings.' }, { status: 400 });
      }

      const pricePerKg = roundTo2(Number(matched.price_per_kg || 0));
      if (pricePerKg <= 0) {
        return NextResponse.json({ error: 'Configured KG pricing is invalid.' }, { status: 400 });
      }

      sizeCategoryName = matched.name || null;
      unitPrice = roundTo2((saleWeightKgRaw * pricePerKg) / quantitySold);
    }

    if (unitPrice < 0) return NextResponse.json({ error: 'Unit price cannot be negative' }, { status: 400 });
    if (unitPrice === 0) {
      return NextResponse.json({ error: 'Unit price resolved to zero. Check pricing settings and sale inputs.' }, { status: 400 });
    }

    const payload = {
      batchId,
      saleDate,
      saleType,
      pricingMethod,
      quantitySold,
      unitPrice,
      buyerDetails,
      saleLengthCm: saleLengthCmRaw,
      saleWeightKg: saleWeightKgRaw,
      sizeCategoryName
    };

    const { data, error } = await admin
      .from('CatfishSale')
      .insert(payload)
      .select('*, batch:CatfishBatch(batchName, status)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_SALE_CREATED',
      entityType: 'CatfishSale',
      entityId: data.id,
      description: `Sale logged for batch ${batchId}`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ sale: data });
  } catch (error: any) {
    console.error('Catfish sale create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing sale id' }, { status: 400 });

    const body = await request.json();
    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from('CatfishSale')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const nextSaleDate = body.saleDate ?? existing.saleDate;
    const nextSaleType = body.saleType === 'Final Clear-Out' ? 'Final Clear-Out' : (body.saleType ?? existing.saleType);
    const nextPricingMethod: 'CM' | 'KG' = String(body.pricingMethod ?? existing.pricingMethod ?? 'CM').toUpperCase() === 'KG' ? 'KG' : 'CM';
    const nextQuantity = Math.max(0, Math.floor(Number(body.quantitySold ?? existing.quantitySold ?? 0)));
    const nextUnitPrice = roundTo2(Number(body.unitPrice ?? existing.unitPrice ?? 0));
    const nextSaleLength = body.saleLengthCm === null
      ? null
      : (body.saleLengthCm === undefined || body.saleLengthCm === '' ? existing.saleLengthCm : roundTo2(Number(body.saleLengthCm)));
    const nextSaleWeight = body.saleWeightKg === null
      ? null
      : (body.saleWeightKg === undefined || body.saleWeightKg === '' ? existing.saleWeightKg : roundTo2(Number(body.saleWeightKg)));
    const nextBuyerDetails = body.buyerDetails ?? existing.buyerDetails ?? null;
    const nextSizeCategory = body.sizeCategoryName ?? existing.sizeCategoryName ?? null;

    if (nextQuantity <= 0) return NextResponse.json({ error: 'Quantity sold must be greater than zero' }, { status: 400 });
    if (nextUnitPrice <= 0) return NextResponse.json({ error: 'Unit price must be greater than zero' }, { status: 400 });
    if (nextSaleLength !== null && Number(nextSaleLength) < 0) {
      return NextResponse.json({ error: 'Sale length cannot be negative' }, { status: 400 });
    }
    if (nextSaleWeight !== null && Number(nextSaleWeight) < 0) {
      return NextResponse.json({ error: 'Sale weight cannot be negative' }, { status: 400 });
    }

    const payload = {
      saleDate: nextSaleDate,
      saleType: nextSaleType,
      pricingMethod: nextPricingMethod,
      quantitySold: nextQuantity,
      unitPrice: nextUnitPrice,
      saleLengthCm: nextSaleLength,
      saleWeightKg: nextSaleWeight,
      sizeCategoryName: nextSizeCategory,
      buyerDetails: nextBuyerDetails
    };

    const { data, error } = await admin
      .from('CatfishSale')
      .update(payload)
      .eq('id', id)
      .select('*, batch:CatfishBatch(batchName, status)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'CATFISH_SALE_UPDATED',
      entityType: 'CatfishSale',
      entityId: data.id,
      description: `Sale updated for batch ${data.batchId}`,
      metadata: payload,
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ sale: data });
  } catch (error: any) {
    console.error('Catfish sale update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
