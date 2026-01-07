import { roundTo2 } from "@/lib/utils";

// lib/calculations/sales.ts
// Derived from 4. SALES CALCULATIONS in CALCULATION.md

/**
 * Calculates revenue for a sale
 * Formula: Quantity * Unit Price
 */
export function calculateRevenue(quantity: number, unitPrice: number): number {
 return roundTo2((quantity || 0) * (unitPrice || 0));
}

/**
 * Calculates Cost of Goods Sold (COGS)
 * Formula: Quantity * Unit Cost Price
 */
export function calculateCOGS(quantity: number, unitCostPrice: number): number {
 return roundTo2((quantity || 0) * (unitCostPrice || 0));
}

/**
 * Calculates Gross Profit
 * Formula: Revenue - COGS
 */
export function calculateGrossProfit(revenue: number, cogs: number): number {
 return roundTo2((revenue || 0) - (cogs || 0));
}

/**
 * Calculates all sales metrics at once for a line item
 */
export function calculateSaleMetrics(
 unitsSold: number,
 unitSellingPrice: number,
 unitCostPrice: number
) {
 const revenue = calculateRevenue(unitsSold, unitSellingPrice);
 const cogs = calculateCOGS(unitsSold, unitCostPrice);
 const profit = calculateGrossProfit(revenue, cogs);

 return {
  revenue,
  cogs,
  profit
 };
}
