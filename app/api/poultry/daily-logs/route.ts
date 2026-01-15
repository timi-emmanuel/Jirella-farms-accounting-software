import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'POULTRY_STAFF'];
const EGGS_PRODUCT_NAME = 'Eggs';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const flockId = searchParams.get('flockId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const admin = createAdminClient();
    let query = admin
      .from('PoultryDailyLog')
      .select('*, flock:PoultryFlock(name, currentCount), feedItem:Ingredient(name, unit)')
      .order('date', { ascending: false });

    if (flockId) query = query.eq('flockId', flockId);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    console.error('Poultry daily logs fetch error:', error);
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

    const {
      flockId,
      date,
      eggsCollected,
      eggsDamaged,
      mortality,
      feedItemId,
      feedConsumedKg,
      notes
    } = await request.json();

    const collected = Number(eggsCollected ?? 0);
    const damaged = Number(eggsDamaged ?? 0);
    const deaths = Number(mortality ?? 0);
    const feedKg = roundTo2(Number(feedConsumedKg ?? 0));

    if (!flockId) {
      return NextResponse.json({ error: 'Flock is required' }, { status: 400 });
    }
    if (collected < 0 || damaged < 0 || deaths < 0) {
      return NextResponse.json({ error: 'Values must be zero or greater' }, { status: 400 });
    }
    if (damaged > collected) {
      return NextResponse.json({ error: 'Damaged eggs cannot exceed collected' }, { status: 400 });
    }
    if (feedKg > 0 && !feedItemId) {
      return NextResponse.json({ error: 'Feed item is required when feed is consumed' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existingProduct } = await admin
      .from('Product')
      .select('id')
      .eq('name', EGGS_PRODUCT_NAME)
      .eq('module', 'POULTRY')
      .single();

    let eggsProductId = existingProduct?.id;
    if (!eggsProductId) {
      const { data: created, error: productError } = await admin
        .from('Product')
        .insert({
          name: EGGS_PRODUCT_NAME,
          module: 'POULTRY',
          unit: 'EGG',
          active: true
        })
        .select('id')
        .single();

      if (productError) {
        return NextResponse.json({ error: productError.message }, { status: 400 });
      }
      eggsProductId = created.id;
    }

    const { data: logId, error: logError } = await admin.rpc('handle_poultry_daily_log', {
      p_flock_id: flockId,
      p_log_date: date ?? new Date().toISOString().split('T')[0],
      p_eggs_collected: Math.round(collected),
      p_eggs_damaged: Math.round(damaged),
      p_mortality: Math.round(deaths),
      p_feed_item_id: feedItemId ?? null,
      p_feed_consumed_kg: feedKg,
      p_notes: notes ?? null,
      p_created_by: auth.userId,
      p_eggs_product_id: eggsProductId
    });

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'POULTRY_DAILY_LOG_CREATED',
      entityType: 'PoultryDailyLog',
      entityId: logId,
      description: `Daily log recorded for flock ${flockId}`,
      metadata: {
        date: date ?? new Date().toISOString().split('T')[0],
        eggsCollected: collected,
        eggsDamaged: damaged,
        mortality: deaths,
        feedConsumedKg: feedKg
      },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ id: logId });
  } catch (error: any) {
    console.error('Poultry daily log create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
