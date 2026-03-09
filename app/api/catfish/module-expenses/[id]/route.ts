import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: expense } = await admin
      .from('CatfishModuleExpense')
      .select('id, amount, description, batchId, stage')
      .eq('id', id)
      .single();

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const { error: deleteError } = await admin
      .from('CatfishModuleExpense')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'DELETE',
      entityType: 'CatfishModuleExpense',
      entityId: id,
      description: `Deleted external expense (₦${Number(expense.amount)}): ${expense.description}`,
      userId: auth.userId,
      userRole: auth.role
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Catfish module-expenses DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
