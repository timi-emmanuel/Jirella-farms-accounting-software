import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const LOCATION_NAMES: Record<string, string> = {
 STORE: 'Store',
 FEED_MILL: 'Feed Mill',
 POULTRY: 'Poultry',
 BSF: 'BSF',
 CATFISH: 'Catfish',
};

const normalizeRequestDate = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return new Date().toISOString().split('T')[0];
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) return text;
  const dmyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemId, quantity, toLocationCode, notes, requestDate } = await request.json();
  const normalizedToCode = String(toLocationCode || '').trim().toUpperCase();
  if (!itemId || !quantity || Number(quantity) <= 0 || !normalizedToCode) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const roundedQty = roundTo2(Number(quantity));
  const normalizedRequestDate = normalizeRequestDate(requestDate);
  if (!normalizedRequestDate) {
   return NextResponse.json({ error: 'Invalid requestDate' }, { status: 400 });
  }

  const admin = createAdminClient();
  let { data: fromLocation } = await admin
    .from('InventoryLocation')
    .select('id')
    .eq('code', 'STORE')
    .single();

  if (!fromLocation) {
    const { data: created } = await admin
      .from('InventoryLocation')
      .insert({ code: 'STORE', name: LOCATION_NAMES.STORE })
      .select('id')
      .single();
    fromLocation = created ?? null;
  }

  let { data: toLocation } = await admin
    .from('InventoryLocation')
    .select('id, code')
    .eq('code', normalizedToCode)
    .single();

  if (!toLocation && LOCATION_NAMES[normalizedToCode]) {
    const { data: created } = await admin
      .from('InventoryLocation')
      .insert({ code: normalizedToCode, name: LOCATION_NAMES[normalizedToCode] })
      .select('id, code')
      .single();
    toLocation = created ?? null;
  }

  if (!fromLocation || !toLocation) {
   return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  }

  const allowedRoles = ['ADMIN', 'STORE_KEEPER', 'FEED_MILL_STAFF', 'POULTRY_STAFF', 'BSF_STAFF', 'MANAGER'];
  if (!isRoleAllowed(auth.role, allowedRoles)) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: requestRow, error: requestError } = await admin
   .from('TransferRequest')
   .insert({
    fromLocationId: fromLocation.id,
    toLocationId: toLocation.id,
   status: 'PENDING',
   requestedBy: auth.userId,
   requestDate: normalizedRequestDate,
   notes: notes ?? null
   })
   .select('*')
   .single();

  if (requestError) {
   return NextResponse.json({ error: requestError.message }, { status: 400 });
  }

  const { error: lineError } = await admin
   .from('TransferRequestLine')
   .insert({
    transferRequestId: requestRow.id,
    itemId,
    quantityRequested: roundedQty
   });

  if (lineError) {
   return NextResponse.json({ error: lineError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'TRANSFER_REQUEST_CREATED',
   entityType: 'TransferRequest',
   entityId: requestRow.id,
   description: `Transfer requested to ${toLocation.code}`,
   metadata: { itemId, quantity: roundedQty, to: toLocation.code },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ request: requestRow });
 } catch (error: any) {
  console.error('Transfer request create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}

export async function GET() {
 try {
  const admin = createAdminClient();
  const { data, error } = await admin
   .from('TransferRequest')
   .select('*, lines:TransferRequestLine(*, item:Ingredient(name, unit)), from:InventoryLocation!TransferRequest_fromLocationId_fkey(code), to:InventoryLocation!TransferRequest_toLocationId_fkey(code)')
   .order('requestDate', { ascending: false, nullsFirst: false })
   .order('createdAt', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const requesterIds = Array.from(
   new Set((data || []).map((request: any) => request.requestedBy).filter(Boolean))
  );

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
  console.error('Transfer requests fetch error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
