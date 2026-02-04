import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!id) return NextResponse.json({ error: 'Missing request id' }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from('FinishedGoodsTransferRequest')
      .update({ status: 'REJECTED', updatedAt: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      action: 'FINISHED_GOODS_TRANSFER_REJECTED',
      entityType: 'FinishedGoodsTransferRequest',
      entityId: id,
      description: 'Finished goods transfer rejected',
      metadata: { requestId: id },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Finished goods transfer reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
