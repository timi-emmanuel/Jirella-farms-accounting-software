
// lib/calculations/recipe.ts
// Derived from 1. RECIPE MASTER CALCULATIONS in CALCULATION.md

export const RECIPE_CONSTANTS = {
 TARGET_SUM: 100, // Percentages must sum to 100
 TOLERANCE: 0.01 // Floating point tolerance
};

interface IngredientInput {
 id: string;
 percentage: number;
 unitPrice: number; // Current weighted average price
}

/**
 * Validates that recipe ingredients sum to 100%
 */
export function validateRecipePercentages(items: { percentage: number }[]): boolean {
 const total = items.reduce((sum, item) => sum + item.percentage, 0);
 return Math.abs(total - RECIPE_CONSTANTS.TARGET_SUM) < RECIPE_CONSTANTS.TOLERANCE;
}

/**
 * Calculates the quantity of each ingredient needed for a specific batch size
 * Formula: (percentage / 100) * batchSize
 */
export function calculateIngredientQuantities(
 items: { ingredientId: string; percentage: number }[],
 batchSize: number
): { ingredientId: string; quantity: number }[] {
 return items.map(item => ({
  ingredientId: item.ingredientId,
  quantity: (item.percentage / 100) * batchSize
 }));
}

/**
 * Estimates the cost of a recipe based on current ingredient prices
 * Formula: SUM(quantity * unit_price)
 */
export function estimateRecipeCost(
 items: IngredientInput[],
 batchSize: number
): { totalCost: number; costPerUnit: number } {
 let totalCost = 0;

 for (const item of items) {
  const quantity = (item.percentage / 100) * batchSize;
  totalCost += quantity * item.unitPrice;
 }

 return {
  totalCost,
  costPerUnit: batchSize > 0 ? totalCost / batchSize : 0
 };
}
