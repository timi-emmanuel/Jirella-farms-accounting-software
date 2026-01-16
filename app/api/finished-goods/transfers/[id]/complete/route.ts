import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = context.params?.id;
    if (!id) return NextResponse.json({ error: 'Missing request id' }, { status: 400 });

    const { notes } = await request.json().catch(() => ({}));
    const admin = createAdminClient();

    if (notes) {
      await admin
        .from('FinishedGoodsTransferRequest')
        .update({ notes })
        .eq('id', id);
    }

    const { error } = await admin.rpc('complete_finished_goods_transfer_request', {
      p_request_id: id,
      p_completed_by: auth.userId
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'FINISHED_GOODS_TRANSFER_COMPLETED',
      entityType: 'FinishedGoodsTransferRequest',
      entityId: id,
      description: 'Finished goods transfer completed',
      metadata: { requestId: id },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Finished goods transfer complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
