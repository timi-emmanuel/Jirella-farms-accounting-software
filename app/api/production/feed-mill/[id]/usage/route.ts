import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { roundTo2 } from '@/lib/utils';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isRoleAllowed(auth.role, ['ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: log, error: logError } = await admin
      .from('ProductionLog')
      .select('id, recipeId, quantityProduced')
      .eq('id', id)
      .single();

    if (logError || !log) {
      return NextResponse.json({ error: 'Production log not found' }, { status: 404 });
    }

    const { data: ledgerRows, error: ledgerError } = await admin
      .from('InventoryLedger')
      .select('itemId, quantity, item:Ingredient(name, unit)')
      .eq('referenceType', 'PRODUCTION_LOG')
      .eq('referenceId', id)
      .eq('type', 'USAGE')
      .eq('direction', 'OUT')
      .order('createdAt', { ascending: true });

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 400 });
    }

    if ((ledgerRows || []).length > 0) {
      const items = (ledgerRows || []).map((row: any) => ({
        ingredientName: row.item?.name || 'Unknown',
        unit: row.item?.unit || 'KG',
        quantityUsed: roundTo2(Number(row.quantity || 0))
      }));
      return NextResponse.json({ items, source: 'ledger' });
    }

    const { data: recipeRows, error: recipeError } = await admin
      .from('RecipeItem')
      .select('percentage, ingredient:Ingredient(name, unit)')
      .eq('recipeId', log.recipeId);

    if (recipeError) {
      return NextResponse.json({ error: recipeError.message }, { status: 400 });
    }

    const quantityProduced = Number(log.quantityProduced || 0);
    const items = (recipeRows || []).map((row: any) => ({
      ingredientName: row.ingredient?.name || 'Unknown',
      unit: row.ingredient?.unit || 'KG',
      quantityUsed: roundTo2((Number(row.percentage || 0) / 100) * quantityProduced)
    }));

    return NextResponse.json({ items, source: 'recipe_fallback' });
  } catch (error: any) {
    console.error('Production usage fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
