/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];
// TODO(next-step): support inter-module fish movement/sales (Fingerlings <-> Juvenile <-> Melange) via transfer ledger.

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
    const saleType = body.saleType === 'Final Clear-Out' ? 'Final Clear-Out' : 'Partial Offload';
    const saleDate = body.saleDate || new Date().toISOString().split('T')[0];
    const buyerDetails = body.buyerDetails ?? null;
    const saleLengthCmRaw = body.saleLengthCm === null || body.saleLengthCm === undefined || body.saleLengthCm === ''
      ? null
      : roundTo2(Number(body.saleLengthCm));
    let sizeCategoryName: string | null = null;

    if (!batchId) return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
    if (quantitySold <= 0) return NextResponse.json({ error: 'Quantity sold must be greater than zero' }, { status: 400 });
    if (unitPrice < 0) return NextResponse.json({ error: 'Unit price cannot be negative' }, { status: 400 });
    if (saleLengthCmRaw !== null && saleLengthCmRaw < 0) {
      return NextResponse.json({ error: 'Sale length cannot be negative' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: batch, error: batchError } = await admin
      .from('CatfishBatch')
      .select('id, productionType')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const autoPriceStage = batch.productionType === 'Fingerlings' || batch.productionType === 'Juvenile';
    if (autoPriceStage && saleLengthCmRaw !== null) {
      const { data: pricingRows, error: pricingError } = await admin
        .from('catfish_size_pricing')
        .select('name, price_per_piece')
        .eq('is_active', true)
        .lte('min_cm', saleLengthCmRaw)
        .gt('max_cm', saleLengthCmRaw)
        .order('min_cm', { ascending: true })
        .limit(1);

      if (pricingError) return NextResponse.json({ error: pricingError.message }, { status: 400 });
      const matched = (pricingRows || [])[0];
      if (!matched) {
        return NextResponse.json({ error: 'No active pricing range found for the supplied length (cm).' }, { status: 400 });
      }

      sizeCategoryName = matched.name || null;
      unitPrice = roundTo2(Number(matched.price_per_piece || 0));
    }

    const payload = {
      batchId,
      saleDate,
      saleType,
      quantitySold,
      unitPrice,
      buyerDetails,
      saleLengthCm: saleLengthCmRaw,
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
