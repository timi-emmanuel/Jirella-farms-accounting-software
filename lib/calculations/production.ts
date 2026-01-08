import { roundTo2 } from "@/lib/utils";

// lib/calculations/production.ts
// Derived from 3. PRODUCTION (FEED MILL) in CALCULATION.md

interface IngredientRequirement {
 id: string;
 name: string;
 percentage: number;
 averageCost: number;
}

/**
 * Calculates full production details for a batch
 * Includes ingredient breakdown and various cost metrics
 */
export function calculateProductionBatch(
 ingredients: IngredientRequirement[],
 quantityToProduce: number
) {
 if (quantityToProduce <= 0) return null;

 let totalCost = 0;
 const breakdown = ingredients.map(ing => {
  const qty = roundTo2((ing.percentage / 100) * quantityToProduce);
  const cost = roundTo2(qty * ing.averageCost);
  totalCost += cost;

  return {
   id: ing.id,
   name: ing.name,
   qty,
   cost
  };
 }).filter(item => item.qty > 0);

 const costPerKg = roundTo2(totalCost / quantityToProduce);

 return {
  ingredientsNeeded: breakdown,
  totalCost: roundTo2(totalCost),
  costPerKg,
  cost15kg: roundTo2(costPerKg * 15),
  cost25kg: roundTo2(costPerKg * 25)
 };
}

/**
 * Calculates just the cost per kg for a recipe based on current prices
 */
export function calculateRecipeUnitCost(ingredients: { percentage: number, averageCost: number }[]): number {
 const totalCostFor100kg = ingredients.reduce((sum, ing) => {
  return sum + (ing.percentage * ing.averageCost);
 }, 0);

 return roundTo2(totalCostFor100kg / 100);
}

/**
 * Calculates the cost for a specific bag weight
 */
export function calculateBagCost(costPerKg: number, bagWeight: number): number {
 return roundTo2((costPerKg || 0) * bagWeight);
}

/**
 * Calculates total cost for a production batch
 */
export function calculateBatchTotal(quantity: number, costPerKg: number): number {
 return roundTo2((quantity || 0) * (costPerKg || 0));
}
