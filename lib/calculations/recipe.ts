import { roundTo2 } from "@/lib/utils";

// lib/calculations/recipe.ts
// Derived from 1. RECIPE MASTER CALCULATIONS in CALCULATION.md

export const RECIPE_CONSTANTS = {
 TARGET_SUM: 100, // Percentages must sum to 100
 TOLERANCE: 0.01 // Floating point tolerance
};

interface RecipeItem {
 percentage: number;
 averageCost: number; // Cost of ingredient
}

/**
 * Validates that recipe ingredients sum to 100%
 */
export function validateRecipePercentages(items: { percentage: number }[]): boolean {
 const total = items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
 return Math.abs(total - RECIPE_CONSTANTS.TARGET_SUM) < RECIPE_CONSTANTS.TOLERANCE;
}

/**
 * Calculates the total cost for a specific batch based on percentages and ingredient averages
 * Formula: SUM((percentage / 100) * batchSize * unitPrice)
 */
export function calculateBatchCost(
 items: RecipeItem[],
 batchSize: number
): number {
 if (!items || items.length === 0) return 0;

 const total = items.reduce((acc, item) => {
  const weight = (Number(item.percentage) / 100) * batchSize;
  return acc + (weight * (Number(item.averageCost) || 0));
 }, 0);

 return roundTo2(total);
}

/**
 * Calculates cost per kg for a recipe
 * Formula: SUM((percentage / 100) * unitPrice)
 */
export function calculateUnitCost(items: RecipeItem[]): number {
 const total = items.reduce((acc, item) => {
  return acc + ((Number(item.percentage) / 100) * (Number(item.averageCost) || 0));
 }, 0);

 return roundTo2(total);
}
