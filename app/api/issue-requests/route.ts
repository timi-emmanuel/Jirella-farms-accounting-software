import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

const MODULE_ROLE_MAP: Record<string, string> = {
 FEED_MILL: 'FEED_MILL_STAFF',
 POULTRY: 'POULTRY_STAFF'
};

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ingredientId, quantity, notes, module } = await request.json();
  if (!ingredientId || !quantity || quantity <= 0 || !module) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const moduleKey = String(module).toUpperCase();
  if (!['FEED_MILL', 'POULTRY'].includes(moduleKey)) {
   return NextResponse.json({ error: 'Invalid module' }, { status: 400 });
  }

  const allowedRoles = ['ADMIN', 'MANAGER', 'STORE_KEEPER', MODULE_ROLE_MAP[moduleKey]];
  if (!isRoleAllowed(auth.role, allowedRoles)) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: item, error: itemError } = await admin
   .from('Ingredient')
   .select('id, name, unit')
   .eq('id', ingredientId)
   .single();

  if (itemError || !item) {
   return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const roundedQty = roundTo2(Number(quantity));

  const { data, error } = await admin
   .from('IssueRequest')
   .insert({
    itemId: item.id,
    itemName: item.name,
    quantity: roundedQty,
    unit: item.unit,
    requestingModule: moduleKey,
    status: 'PENDING',
    requestedBy: auth.userId,
    notes: notes ?? null
   })
   .select('*')
   .single();

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'ISSUE_REQUEST_CREATED',
   entityType: 'IssueRequest',
   entityId: data?.id,
   description: `Requested ${roundedQty}${item.unit} of ${item.name}`,
   metadata: { item: item.name, qty: roundedQty, module: moduleKey },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ request: data });
 } catch (error: any) {
  console.error('Issue request create error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
