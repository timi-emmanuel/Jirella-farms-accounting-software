import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { reason } = await request.json().catch(() => ({}));

    const admin = createAdminClient();

    const { data: existing, error: existingError } = await admin
      .from('ProductionLog')
      .select('id, recipeId, quantityProduced, isUndone')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Production log not found' }, { status: 404 });
    }
    if (existing.isUndone) {
      return NextResponse.json({ error: 'Production run already undone' }, { status: 400 });
    }

    const { error: rpcError } = await admin.rpc('undo_production_run', {
      p_production_log_id: id,
      p_user_id: auth.userId,
      p_reason: typeof reason === 'string' ? reason : null
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'PRODUCTION_RUN_UNDONE',
      entityType: 'ProductionLog',
      entityId: id,
      description: `Undid production run (${existing.quantityProduced} kg)`,
      metadata: { reason: typeof reason === 'string' ? reason : null, recipeId: existing.recipeId },
      userId: auth.userId,
      userRole: auth.role,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Undo production run error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
