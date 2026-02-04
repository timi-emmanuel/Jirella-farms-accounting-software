import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'PROCUREMENT_MANAGER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!id) {
   return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  }
  const admin = createAdminClient();

  const { data: requestRow, error: fetchError } = await admin
   .from('ProcurementRequest')
   .select('*')
   .eq('id', id)
   .single();

  if (fetchError || !requestRow) {
   return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (requestRow.status !== 'PENDING') {
   return NextResponse.json({ error: 'Only pending requests can be approved' }, { status: 400 });
  }

  const { error } = await admin
   .from('ProcurementRequest')
   .update({
    status: 'APPROVED',
    approvedBy: auth.userId,
    updatedAt: new Date().toISOString()
   })
   .eq('id', id);

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'PROCUREMENT_REQUEST_APPROVED',
   entityType: 'ProcurementRequest',
   entityId: id,
   description: `Approved procurement request ${id}`,
   metadata: { requestId: id },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Procurement approve error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
