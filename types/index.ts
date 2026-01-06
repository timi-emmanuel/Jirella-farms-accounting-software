
export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';
export type UnitOfMeasure = 'KG' | 'TON' | 'LITER' | 'BAG';
export type TransactionType = 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'RETURN';

export interface UserProfile {
 id: string;
 email: string;
 role: UserRole;
 createdAt: string;
}

export interface Ingredient {
 id: string;
 name: string;
 description: string | null;
 unit: UnitOfMeasure;
 currentStock: number; // In base unit (KG)
 averageCost: number; // Cost per unit (KG)
 openingStock?: number;
 purchasedQuantity?: number;
 usedInProduction?: number;
 lastPurchasedPrice?: number;
 createdAt: string;
 updatedAt: string;
}

export interface Recipe {
 id: string;
 name: string;
 description: string | null;
 targetBatchSize: number;
 isActive: boolean;
 createdAt: string;
 updatedAt: string;
 // Relations
 items?: RecipeItem[];
}

export interface RecipeItem {
 id: string;
 recipeId: string;
 ingredientId: string;
 percentage: number;
 // Relations
 ingredient?: Ingredient;
}

export interface InventoryTransaction {
 id: string;
 ingredientId: string;
 type: TransactionType;
 quantity: number;
 unitPrice: number;
 totalValue: number;
 reference: string | null;
 notes: string | null;
 date: string;
 createdAt: string;
}

export interface FeedBatch {
 id: string;
 batchNumber: string;
 recipeId: string;
 quantityProduced: number;
 costPerUnit: number;
 totalCost: number;
 date: string;
 createdAt: string;
}
