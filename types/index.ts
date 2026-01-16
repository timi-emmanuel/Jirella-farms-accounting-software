

export type UserRole = 'ADMIN' | 'MANAGER' | 'FEED_MILL_STAFF' | 'POULTRY_STAFF' | 'ACCOUNTANT' | 'PROCUREMENT_MANAGER' | 'STORE_KEEPER' | 'STAFF';
export type UnitOfMeasure = 'KG' | 'TON' | 'LITER' | 'BAG' | 'CRATE';
export type TransactionType = 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'RETURN';
export type StoreRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECEIVED';
export type IssueRequestStatus = 'PENDING' | 'APPROVED' | 'ISSUED' | 'REJECTED' | 'CANCELLED';
export type RequestingModule = 'FEED_MILL' | 'POULTRY';

export interface UserProfile {
 id: string;
 email: string;
 role: UserRole;
 createdAt: string;
}

export interface StoreRequest {
 id: string;
 itemId: string;
 itemName: string;
 quantity: number;
 unit: string;
 purpose: string | null;
 status: StoreRequestStatus;
 requestedBy: string; // User ID
 approvedBy?: string; // User ID
 createdAt: string;
 updatedAt: string;
 // Relations (optional based on fetch)
 requester?: UserProfile;
 approver?: UserProfile;
}

export interface ActivityLog {
 id: string;
 userId: string;
 userRole?: string; // Snapshot of role
 action: string;
 entityType: string;
 entityId?: string;
 description?: string; // Human readable summary
 metadata?: any; // JSON for before/after values
 ipAddress?: string;
 timestamp: string;
 // Relation
 user?: UserProfile;
}

export interface IssueRequest {
 id: string;
 itemId: string;
 itemName: string;
 quantity: number;
 unit: string;
 requestingModule: RequestingModule;
 status: IssueRequestStatus;
 requestedBy: string;
 approvedBy?: string;
 issuedBy?: string;
 issuedQuantity?: number;
 notes?: string | null;
 createdAt: string;
 updatedAt: string;
}

export interface Ingredient {
 id: string;
 name: string;
 description: string | null;
 unit: UnitOfMeasure;
 trackInFeedMill: boolean;
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

export interface FeedMillSale {
 id: string;
 date: string;
 recipeId: string;
 unitsSold: number;
 unitSellingPrice: number;
 unitCostPrice: number;
 totalRevenue: number;
 costOfGoodsSold: number;
 grossProfit: number;
 createdAt: string;
 updatedAt: string;
 // Relations
 recipe?: Recipe;
}

export type ProductModule = 'FEED_MILL' | 'POULTRY';
export type ExpenseModule = 'FEED_MILL' | 'POULTRY';

export interface Product {
 id: string;
 name: string;
 module: ProductModule;
 unit: string;
 unitSizeKg?: number | null;
 active: boolean;
 createdAt: string;
 updatedAt: string;
}

export interface FinishedGoodsInventory {
 productId: string;
 locationId: string;
 quantityOnHand: number;
 averageUnitCost: number;
 updatedAt: string;
 product?: Product;
}

export interface FinishedGoodsLedger {
 id: string;
 productId: string;
 locationId: string;
 type: 'PRODUCTION_IN' | 'SALE_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'USAGE' | 'ADJUSTMENT';
 quantity: number;
 unitCostAtTime?: number;
 referenceType?: string;
 referenceId?: string;
 createdBy?: string;
 createdAt: string;
}

export interface Sale {
 id: string;
 productId: string;
 module: ProductModule;
 quantitySold: number;
 unitSellingPrice: number;
 unitCostAtSale: number;
 soldAt: string;
 soldBy?: string;
 notes?: string | null;
 createdAt: string;
 product?: Product;
}

export interface ProductionLog {
 id: string;
 date: string;
 recipeId: string;
 quantityProduced: number; // In KG
 costPerKg: number; // Historical cost audit
 cost15kg?: number;
 cost25kg?: number;
 createdAt: string;
 updatedAt: string;
 // Relations
 recipe?: Recipe;
}

export type PoultryFlockStatus = 'ACTIVE' | 'CLOSED';

export interface PoultryFlock {
 id: string;
 name: string;
 breed?: string | null;
 initialCount: number;
 currentCount: number;
 startDate: string;
 status: PoultryFlockStatus;
 createdAt: string;
 updatedAt: string;
}

export interface PoultryDailyLog {
 id: string;
 flockId: string;
 date: string;
 eggsCollected: number;
 eggsDamaged: number;
 mortality: number;
 feedItemId?: string | null;
 feedProductId?: string | null;
 feedConsumedKg: number;
 notes?: string | null;
 createdAt: string;
 updatedAt: string;
 flock?: PoultryFlock;
 feedItem?: Ingredient;
 feedProduct?: Product;
}

export interface FinishedGoodsTransferRequest {
 id: string;
 fromLocationId: string;
 toLocationId: string;
 status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
 requestedBy?: string | null;
 approvedBy?: string | null;
 completedBy?: string | null;
 notes?: string | null;
 createdAt: string;
 updatedAt: string;
 lines?: FinishedGoodsTransferLine[];
}

export interface FinishedGoodsTransferLine {
 id: string;
 transferRequestId: string;
 productId: string;
 quantityRequested: number;
 quantityTransferred?: number | null;
 product?: Product;
}

export interface Expense {
 id: string;
 module: ExpenseModule;
 category: string;
 amount: number;
 spentAt: string;
 notes?: string | null;
 createdBy?: string | null;
 createdAt: string;
}

export interface PoultryDashboardMetrics {
 totalEggs: number;
 totalDamaged: number;
 totalMortality: number;
 totalFeedKg: number;
 currentLiveBirds: number;
 henDayProduction: number;
 feedPerBirdG: number;
 fcrPerDozen: number;
 costPerCrate: number;
 totalSales: number;
 totalCogs: number;
 totalExpenses: number;
 profit: number;
}
