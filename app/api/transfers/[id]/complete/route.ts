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

  if (!id) {
   return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  }
  const { notes } = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  if (notes) {
   await admin
    .from('TransferRequest')
    .update({ notes })
    .eq('id', id);
  }

  const { error } = await admin.rpc('complete_transfer_request', {
   p_request_id: id,
   p_completed_by: auth.userId
  });

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'TRANSFER_REQUEST_COMPLETED',
   entityType: 'TransferRequest',
   entityId: id,
   description: `Transfer request completed`,
   metadata: { requestId: id },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Transfer complete error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
