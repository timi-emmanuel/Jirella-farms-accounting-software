/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

const ADMIN_ROLES = ['ADMIN'];
const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];

const isFiniteNumber = (value: unknown) => Number.isFinite(Number(value));

const validatePricingPayload = (body: any) => {
  const name = String(body?.name || '').trim();
  const minCm = Number(body?.min_cm);
  const maxCm = Number(body?.max_cm);
  const pricePerPiece = Number(body?.price_per_piece);

  if (!name) return 'Category name is required';
  if (!isFiniteNumber(minCm) || !isFiniteNumber(maxCm)) return 'Min CM and Max CM are required';
  if (minCm < 0 || maxCm < 0) return 'CM values cannot be negative';
  if (minCm >= maxCm) return 'Min CM must be less than Max CM';
  if (!isFiniteNumber(pricePerPiece) || pricePerPiece <= 0) return 'Price per piece must be greater than zero';
  return null;
};

const findOverlappingActiveRange = async (
  admin: ReturnType<typeof createAdminClient>,
  minCm: number,
  maxCm: number,
  excludeId?: string
) => {
  let query = admin
    .from('catfish_size_pricing')
    .select('id, name, min_cm, max_cm')
    .eq('is_active', true)
    .lt('min_cm', maxCm)
    .gt('max_cm', minCm)
    .limit(1);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) return { overlap: null, error };
  return { overlap: (data || [])[0] || null, error: null };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const cmParam = searchParams.get('cm');

    if (cmParam !== null && cmParam !== '') {
      const cm = Number(cmParam);
      if (!Number.isFinite(cm) || cm < 0) {
        return NextResponse.json({ error: 'cm must be a valid positive number' }, { status: 400 });
      }

      const { data, error } = await admin
        .from('catfish_size_pricing')
        .select('*')
        .eq('is_active', true)
        .lte('min_cm', cm)
        .gt('max_cm', cm)
        .order('min_cm', { ascending: true })
        .limit(1);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ row: (data || [])[0] || null });
    }

    let query = admin
      .from('catfish_size_pricing')
      .select('*')
      .order('min_cm', { ascending: true });

    if (auth.role !== 'ADMIN') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ rows: data || [] });
  } catch (error: any) {
    console.error('Catfish pricing settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validationError = validatePricingPayload(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const name = String(body.name).trim();
    const minCm = roundTo2(Number(body.min_cm));
    const maxCm = roundTo2(Number(body.max_cm));
    const pricePerPiece = roundTo2(Number(body.price_per_piece));
    const isActive = body.is_active === false ? false : true;

    const admin = createAdminClient();

    if (isActive) {
      const { overlap, error: overlapError } = await findOverlappingActiveRange(admin, minCm, maxCm);
      if (overlapError) return NextResponse.json({ error: overlapError.message }, { status: 400 });
      if (overlap) {
        return NextResponse.json(
          { error: `Active range overlaps with "${overlap.name}" (${overlap.min_cm}-${overlap.max_cm} cm).` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await admin
      .from('catfish_size_pricing')
      .insert({
        name,
        min_cm: minCm,
        max_cm: maxCm,
        price_per_piece: pricePerPiece,
        is_active: isActive
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ row: data });
  } catch (error: any) {
    console.error('Catfish pricing settings POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, ADMIN_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing pricing id' }, { status: 400 });

    const body = await request.json();
    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from('catfish_size_pricing')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Pricing row not found' }, { status: 404 });
    }

    const nextData = {
      name: body.name ?? existing.name,
      min_cm: body.min_cm ?? existing.min_cm,
      max_cm: body.max_cm ?? existing.max_cm,
      price_per_piece: body.price_per_piece ?? existing.price_per_piece,
      is_active: body.is_active ?? existing.is_active
    };

    const validationError = validatePricingPayload(nextData);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const minCm = roundTo2(Number(nextData.min_cm));
    const maxCm = roundTo2(Number(nextData.max_cm));
    const pricePerPiece = roundTo2(Number(nextData.price_per_piece));
    const isActive = Boolean(nextData.is_active);

    if (isActive) {
      const { overlap, error: overlapError } = await findOverlappingActiveRange(admin, minCm, maxCm, id);
      if (overlapError) return NextResponse.json({ error: overlapError.message }, { status: 400 });
      if (overlap) {
        return NextResponse.json(
          { error: `Active range overlaps with "${overlap.name}" (${overlap.min_cm}-${overlap.max_cm} cm).` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await admin
      .from('catfish_size_pricing')
      .update({
        name: String(nextData.name).trim(),
        min_cm: minCm,
        max_cm: maxCm,
        price_per_piece: pricePerPiece,
        is_active: isActive
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ row: data });
  } catch (error: any) {
    console.error('Catfish pricing settings PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
