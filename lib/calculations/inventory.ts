import { roundTo2 } from "@/lib/utils";

// lib/calculations/inventory.ts
// Derived from 2. RAW MATERIAL INVENTORY in CALCULATION.md

/**
 * Calculates current stock balance from transaction history.
 * Formula: Opening + Purchased - Used
 */
export function calculateClosingBalance(opening: number, purchased: number, used: number): number {
 return roundTo2((opening || 0) + (purchased || 0) - (used || 0));
}

/**
 * Calculates the total value of current inventory
 * Formula: Closing Balance * Weighted Average Price
 */
export function calculateInventoryValue(closingBalance: number, averagePrice: number): number {
 return roundTo2((closingBalance || 0) * (averagePrice || 0));
}

/**
 * Calculates Weighted Average Price after a new purchase
 * Formula: ((Old Stock * Old Price) + (New Stock * New Price)) / Total Stock
 */
export function calculateNewWeightedAveragePrice(
 oldStock: number,
 oldAvgPrice: number,
 newQty: number,
 newUnitPrice: number
): number {
 const oldTotalValue = (oldStock || 0) * (oldAvgPrice || 0);
 const newTotalValue = (newQty || 0) * (newUnitPrice || 0);
 const totalQty = (oldStock || 0) + (newQty || 0);

 if (totalQty <= 0) return 0;
 return roundTo2((oldTotalValue + newTotalValue) / totalQty);
}

/**
 * Calculates total purchase entry cost
 * Formula: Quantity * Unit Price
 */
export function calculateEntryTotal(quantity: number, unitPrice: number): number {
 return roundTo2((quantity || 0) * (unitPrice || 0));
}
