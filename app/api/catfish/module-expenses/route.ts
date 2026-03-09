import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';

const VIEW_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF', 'ACCOUNTANT'];
const EDIT_ROLES = ['ADMIN', 'MANAGER', 'CATFISH_STAFF'];

type CatfishExpenseStage = 'Hatchery' | 'Fingerlings' | 'Juvenile' | 'Grow-out (Adult)';
type BatchRow = { id: string; batchName?: string | null; productionType?: string | null };
type ExpenseRow = {
  id: string;
  batchId?: string | null;
  stage?: string | null;
  expenseDate: string;
  description: string;
  amount: number;
  createdAt: string;
};

const normalizeStage = (value: unknown): CatfishExpenseStage | null => {
  const input = String(value || '').trim();
  if (!input) return null;
  if (input === 'Hatchery') return 'Hatchery';
  if (input === 'Juvenile') return 'Juvenile';
  if (input === 'Grow-out (Adult)' || input === 'Grow-out' || input === 'Growout' || input === 'Melange') {
    return 'Grow-out (Adult)';
  }
  return 'Fingerlings';
};

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, VIEW_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const stage = normalizeStage(searchParams.get('stage') || searchParams.get('productionType'));

    const admin = createAdminClient();
    let batchIds: string[] = [];
    if (stage && stage !== 'Hatchery') {
      const { data: batches } = await admin
        .from('CatfishBatch')
        .select('id')
        .eq('productionType', stage);
      batchIds = (batches || []).map((batch: { id: string }) => batch.id);
    }

    let query = admin
      .from('CatfishModuleExpense')
      .select('id, batchId, stage, expenseDate, description, amount, createdAt');

    if (stage === 'Hatchery') {
      query = query.eq('stage', 'Hatchery');
    } else if (batchIds.length > 0) {
      query = query.in('batchId', batchIds);
    } else if (stage) {
      return NextResponse.json({ expenses: [] });
    }

    const { data: expenses, error } = await query.order('expenseDate', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const batchNameMap = new Map<string, string>();
    const expenseRows = (expenses || []) as ExpenseRow[];
    const uniqueBatchIds = Array.from(new Set(expenseRows.map((expense) => expense.batchId).filter(Boolean))) as string[];
    if (uniqueBatchIds.length > 0) {
      const { data: batchData } = await admin
        .from('CatfishBatch')
        .select('id, batchName')
        .in('id', uniqueBatchIds);
      (batchData || []).forEach((batch: BatchRow) => {
        batchNameMap.set(batch.id, batch.batchName || 'Unknown');
      });
    }

    return NextResponse.json({
      expenses: expenseRows.map((expense) => ({
        ...expense,
        batchName: expense.batchId ? (batchNameMap.get(expense.batchId) || 'Unknown') : 'Hatchery'
      }))
    });
  } catch (error: unknown) {
    console.error('Catfish module-expenses GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, EDIT_ROLES)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const batchId = body.batchId ? String(body.batchId) : null;
    const expenseDate = String(body.expenseDate || '');
    const description = String(body.description || '').trim();
    const amount = Number(body.amount);
    const stage = normalizeStage(body.stage);
    const isHatcheryExpense = stage === 'Hatchery';

    if ((!isHatcheryExpense && !batchId) || !expenseDate || !description || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: expenseDate, description, amount, and batchId for non-hatchery expenses' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    let batch: BatchRow | null = null;
    if (!isHatcheryExpense) {
      const { data, error: batchError } = await admin
        .from('CatfishBatch')
        .select('id, batchName, productionType')
        .eq('id', batchId)
        .single();

      if (batchError || !data) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
      }
      batch = data as BatchRow;
    }

    const { data: expense, error: insertError } = await admin
      .from('CatfishModuleExpense')
      .insert({
        batchId: isHatcheryExpense ? null : batchId,
        stage: isHatcheryExpense ? 'Hatchery' : (batch?.productionType || null),
        expenseDate,
        description,
        amount,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    await logActivityServer({
      action: 'CREATE',
      entityType: 'CatfishModuleExpense',
      description: `Added ₦${amount} external expense to ${isHatcheryExpense ? 'Hatchery' : batch?.batchName}: ${description}`,
      userId: auth.userId,
      userRole: auth.role
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: unknown) {
    console.error('Catfish module-expenses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
