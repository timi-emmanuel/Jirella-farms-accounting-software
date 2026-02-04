import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: requestRow, error: fetchError } = await admin
   .from('IssueRequest')
   .select('*')
   .eq('id', id)
   .single();

  if (fetchError || !requestRow) {
   return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (requestRow.status !== 'PENDING') {
   return NextResponse.json({ error: 'Only pending requests can be rejected' }, { status: 400 });
  }

  const { error } = await admin
   .from('IssueRequest')
   .update({
    status: 'REJECTED',
    approvedBy: auth.userId,
    updatedAt: new Date().toISOString()
   })
   .eq('id', id);

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'ISSUE_REQUEST_REJECTED',
   entityType: 'IssueRequest',
   entityId: id,
   description: `Rejected issue request for ${requestRow.quantity}${requestRow.unit} of ${requestRow.itemName}`,
   metadata: { item: requestRow.itemName, qty: requestRow.quantity },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Issue request reject error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
