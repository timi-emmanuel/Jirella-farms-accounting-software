import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'STORE_KEEPER'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pathname = new URL(request.url).pathname;
  const pathParts = pathname.split('/').filter(Boolean);
  const idFromPath = pathParts.length >= 3 ? pathParts[2] : null;
  const id = (context.params?.id ?? idFromPath)?.trim();
  if (!id) {
   return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  }
  const admin = createAdminClient();

  const { data: requestRow, error: fetchError } = await admin
   .from('TransferRequest')
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
   .from('TransferRequest')
   .update({ status: 'REJECTED', approvedBy: auth.userId, updatedAt: new Date().toISOString() })
   .eq('id', id);

  if (error) {
   return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'TRANSFER_REQUEST_REJECTED',
   entityType: 'TransferRequest',
   entityId: id,
   description: `Transfer request rejected`,
   metadata: { requestId: id },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Transfer reject error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
