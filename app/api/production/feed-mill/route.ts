import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isRoleAllowed } from '@/lib/server/auth';
import { logActivityServer } from '@/lib/server/activity-log';
import { roundTo2 } from '@/lib/utils';

export async function POST(request: NextRequest) {
 try {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isRoleAllowed(auth.role, ['ADMIN', 'MANAGER', 'FEED_MILL_STAFF'])) {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { recipeId, quantityProduced, producedAt, bagSizeKg, bagsProduced } = await request.json();
  if (!recipeId || !quantityProduced || Number(quantityProduced) <= 0) {
   return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const roundedQtyProduced = roundTo2(Number(quantityProduced));

  const admin = createAdminClient();
  const { data: recipe, error: recipeError } = await admin
   .from('Recipe')
   .select('id, name, items:RecipeItem(percentage, ingredient:Ingredient(id, name))')
   .eq('id', recipeId)
   .single();

  if (recipeError || !recipe) {
   return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const productionDate = producedAt ?? new Date().toISOString().split('T')[0];

  const { data: location } = await admin
   .from('InventoryLocation')
   .select('id')
   .eq('code', 'FEED_MILL')
   .single();

  if (!location) {
   return NextResponse.json({ error: 'Feed mill location not found' }, { status: 400 });
  }

  const itemIds = (recipe.items || []).map((item: any) => item.ingredient?.id).filter(Boolean);
  const { data: balances } = await admin
   .from('InventoryBalance')
   .select('itemId, quantityOnHand, averageUnitCost')
   .eq('locationId', location.id)
   .in('itemId', itemIds);

  const balanceMap = new Map(
   (balances || []).map((b: any) => [b.itemId, { qty: Number(b.quantityOnHand || 0), avg: Number(b.averageUnitCost || 0) }])
  );

  let computedCostPerKg = 0;
  for (const item of recipe.items || []) {
   const ingredientId = item.ingredient?.id;
   const ingredientName = item.ingredient?.name || 'Unknown';
   const percentage = Number(item.percentage) || 0;
   const requiredQty = roundTo2((percentage / 100) * roundedQtyProduced);
   const balance = balanceMap.get(ingredientId);
   const available = balance?.qty ?? 0;

   if (available < requiredQty) {
    return NextResponse.json(
     { error: `Insufficient stock for ${ingredientName}` },
     { status: 400 }
    );
   }

   computedCostPerKg += (percentage / 100) * (balance?.avg ?? 0);
  }

  const roundedCostPerKg = roundTo2(computedCostPerKg);

  const { error: productionError } = await admin.rpc('handle_production_location', {
   p_recipe_id: recipeId,
   p_quantity_produced: roundedQtyProduced,
   p_cost_per_kg: roundedCostPerKg,
   p_date: productionDate,
   p_location_code: 'FEED_MILL',
   p_created_by: auth.userId
  });

  if (productionError) {
   return NextResponse.json({ error: productionError.message }, { status: 400 });
  }

  const size = Number(bagSizeKg);
  const bags = Number(bagsProduced);
  const hasBagInfo = !!size && !!bags;

  const productName = hasBagInfo
   ? `${recipe.name} ${size}kg`
   : `${recipe.name} (Bulk)`;
  const productUnit = hasBagInfo ? 'BAG' : 'KG';
  const producedQty = roundTo2(hasBagInfo ? bags : roundedQtyProduced);
  const unitSizeKg = hasBagInfo ? size : null;
  const unitCostAtTime = roundTo2(hasBagInfo ? roundedCostPerKg * size : roundedCostPerKg);

  const { data: product, error: productError } = await admin
   .from('Product')
   .select('*')
   .eq('name', productName)
   .single();

  let productId = product?.id;
  if (!productId) {
   const { data: createdProduct, error: createError } = await admin
    .from('Product')
    .insert({
     name: productName,
     module: 'FEED_MILL',
     unit: productUnit,
     unitSizeKg,
     active: true
    })
    .select('*')
    .single();

   if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
   }
   productId = createdProduct.id;
  }

  const { data: existingStock } = await admin
   .from('FinishedGoodsInventory')
   .select('*')
   .eq('productId', productId)
   .eq('locationId', location.id)
   .single();

  const currentQty = Number(existingStock?.quantityOnHand || 0);
  const currentAvg = Number(existingStock?.averageUnitCost || 0);
  const nextQty = roundTo2(currentQty + producedQty);
  const nextAvg = nextQty > 0
   ? ((currentQty * currentAvg) + (producedQty * unitCostAtTime)) / nextQty
   : unitCostAtTime;
  const roundedNextAvg = roundTo2(nextAvg);

  if (existingStock) {
   const { error: stockError } = await admin
    .from('FinishedGoodsInventory')
     .update({
      quantityOnHand: nextQty,
      averageUnitCost: roundedNextAvg,
      updatedAt: new Date().toISOString()
     })
    .eq('productId', productId)
    .eq('locationId', location.id);

   if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 400 });
   }
  } else {
   const { error: stockError } = await admin
    .from('FinishedGoodsInventory')
    .insert({
     productId,
     locationId: location.id,
     quantityOnHand: producedQty,
     averageUnitCost: unitCostAtTime
    });

   if (stockError) {
    return NextResponse.json({ error: stockError.message }, { status: 400 });
   }
  }

  const { error: ledgerError } = await admin
   .from('FinishedGoodsLedger')
    .insert({
     productId,
     locationId: location.id,
     type: 'PRODUCTION_IN',
     quantity: producedQty,
     unitCostAtTime,
    referenceType: 'PRODUCTION_LOG',
    referenceId: `${recipeId}:${productionDate}`,
    createdBy: auth.userId
   });

  if (ledgerError) {
   return NextResponse.json({ error: ledgerError.message }, { status: 400 });
  }

  await logActivityServer({
   action: 'PRODUCTION_LOGGED',
   entityType: 'ProductionLog',
   entityId: recipeId,
   description: `Produced ${quantityProduced}kg of ${recipe.name}`,
   metadata: { recipe: recipe.name, quantity: roundedQtyProduced, bagSizeKg: size, bagsProduced: bags },
   userId: auth.userId,
   userRole: auth.role,
   ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
  });

  return NextResponse.json({ success: true });
 } catch (error: any) {
  console.error('Feed mill production error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
 }
}
