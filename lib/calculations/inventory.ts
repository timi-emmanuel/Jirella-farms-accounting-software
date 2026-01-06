
// lib/calculations/inventory.ts
// Derived from 2. RAW MATERIAL INVENTORY in CALCULATION.md

// lib/calculations/inventory.ts
// Derived from 2. RAW MATERIAL INVENTORY in CALCULATION.md
import type { TransactionType } from "@/types";

interface Transaction {
 type: TransactionType;
 quantity: number;
 totalValue: number;
}

/**
 * Calculates current stock balance from transaction history.
 * Formula: Opening + In - Out
 * In our case, Purchase/Adjustment (Positive) + Usage (Negative)
 */
export function calculateClosingBalance(transactions: Transaction[]): number {
 return transactions.reduce((balance, tx) => {
  // Assuming 'quantity' is signed correctly in the DB
  // If Purchases are positive and Usage is negative:
  return balance + tx.quantity;
 }, 0);
}

/**
 * Calculates Weighted Average Price
 * Formula: Total Value of Stock / Total Quantity
 * Note: This can be complex depending on accounting method (FIFO vs AVG). 
 * Simplest MVP approach: Total Value of currently held stock / Current Quantity
 */
export function calculateWeightedAveragePrice(transactions: Transaction[]): number {
 let totalQuantity = 0;
 let totalValue = 0;

 // This is a naive implementation. True WAVCO requires processing in chronological order.
 // For MVP, we will assume we recalculate based on *remaining* stock value.

 // Better Approach for MVP:
 // Just return the average of the *current* stock if we tracked value-in and value-out.
 // Ideally, we run through history:

 for (const tx of transactions) {
  totalQuantity += tx.quantity;
  totalValue += tx.totalValue; // Value change (Purchase cost or Usage cost)
 }

 if (totalQuantity <= 0) return 0;
 return totalValue / totalQuantity;
}
