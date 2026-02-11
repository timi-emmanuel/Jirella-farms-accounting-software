

export type UserRole = 'ADMIN' | 'MANAGER' | 'FEED_MILL_STAFF' | 'BSF_STAFF' | 'POULTRY_STAFF' | 'CATFISH_STAFF' | 'ACCOUNTANT' | 'PROCUREMENT_MANAGER' | 'STORE_KEEPER' | 'STAFF';
export type UnitOfMeasure = 'KG' | 'TON' | 'LITER' | 'BAG' | 'CRATE';
export type TransactionType = 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'RETURN';
export type StoreRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECEIVED';
export type IssueRequestStatus = 'PENDING' | 'APPROVED' | 'ISSUED' | 'REJECTED' | 'CANCELLED';
export type RequestingModule = 'FEED_MILL' | 'POULTRY';

export interface UserProfile {
 id: string;
 email: string;
 role: UserRole;
 isActive?: boolean;
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

export type ProductModule = 'FEED_MILL' | 'POULTRY' | 'BSF' | 'CATFISH';
export type ExpenseModule = 'FEED_MILL' | 'POULTRY' | 'BSF' | 'CATFISH';

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
 type: 'PRODUCTION_IN' | 'SALE_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'USAGE' | 'ADJUSTMENT' | 'INTERNAL_SALE_OUT' | 'INTERNAL_PURCHASE_IN';
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
 locationId?: string;
 quantitySold: number;
 unitSellingPrice: number;
 unitCostAtSale: number;
 saleType?: 'EXTERNAL' | 'INTERNAL';
 customerName?: string | null;
 customerContact?: string | null;
 customerAddress?: string | null;
 sourceUnit?: string | null;
 productType?: string | null;
 totalAmount?: number | null;
 soldAt: string;
 soldBy?: string;
 notes?: string | null;
 createdAt: string;
 batchId?: string | null;
 product?: Product;
}

export type CatfishPondStatus = 'ACTIVE' | 'MAINTENANCE';
export type CatfishWaterType = 'EARTHEN' | 'CONCRETE' | 'TANK';

export interface CatfishPond {
 id: string;
 name: string;
 capacityFish: number;
 waterType: CatfishWaterType;
 status: CatfishPondStatus;
 createdAt: string;
 updatedAt: string;
}

export type CatfishBatchStatus = 'GROWING' | 'HARVESTING' | 'CLOSED';

export interface CatfishBatch {
 id: string;
 batchCode: string;
 pondId: string;
 startDate: string;
 initialFingerlingsCount: number;
 fingerlingUnitCost: number;
 totalFingerlingCost: number;
 status: CatfishBatchStatus;
 notes?: string | null;
 createdAt: string;
 updatedAt: string;
 pond?: CatfishPond;
 mortalityTotal?: number;
 harvestedCount?: number;
 fishesLeft?: number;
}

export interface CatfishFeedLog {
 id: string;
 batchId: string;
 date: string;
 feedProductId: string;
 quantityKg: number;
 unitCostAtTime: number;
 totalCost: number;
 createdAt: string;
 batch?: CatfishBatch;
 feedProduct?: Product;
}

export interface CatfishMortalityLog {
 id: string;
 batchId: string;
 date: string;
 deadCount: number;
 cause?: string | null;
 createdAt: string;
 batch?: CatfishBatch;
}

export interface CatfishHarvest {
 id: string;
 batchId: string;
 date: string;
 quantityKg: number;
 fishCountHarvested?: number | null;
 averageFishWeightKg: number;
 notes?: string | null;
 createdAt: string;
 batch?: CatfishBatch;
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

export interface FeedInternalPurchase {
 id: string;
 productId: string;
 quantityKg: number;
 unitPrice: number;
 totalAmount: number;
 purchaseDate: string;
 soldByUserId?: string | null;
 boughtByUserId?: string | null;
 createdAt: string;
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

export type BsfBatchStatus = 'GROWING' | 'HARVESTED' | 'PROCESSED' | 'CLOSED';
export type BsfProcessType = 'DRYING' | 'PRESSING_EXTRACTION';

export interface BsfInsectoriumLog {
  id: string;
  date: string;
  pupaeLoadedKg: number;
  eggsHarvestedGrams: number;
  pupaeShellsHarvestedKg: number;
  deadFlyKg: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BsfLarvariumBatch {
 id: string;
 batchCode: string;
 startDate: string;
 eggsGramsUsed: number;
 initialLarvaeWeightGrams: number;
 substrateMixRatio?: string | null;
 status: BsfBatchStatus;
 harvestDate?: string | null;
 notes?: string | null;
 createdBy?: string | null;
 createdAt: string;
 updatedAt: string;
}

export interface BsfBatchFeedLog {
 id: string;
 batchId: string;
 date: string;
 pkcKg: number;
 poultryWasteKg: number;
 poultryWasteCostOverride?: number | null;
 notes?: string | null;
 createdBy?: string | null;
 createdAt: string;
}

export interface BsfHarvestYield {
 id: string;
 batchId: string;
 wetLarvaeKg: number;
 frassKg: number;
 residueWasteKg: number;
 createdBy?: string | null;
 createdAt: string;
}

export interface BsfProcessingRun {
 id: string;
 batchId: string;
 processType: BsfProcessType;
 inputWeightKg: number;
 outputDryLarvaeKg: number;
 outputLarvaeOilLiters: number;
 outputLarvaeCakeKg: number;
 energyCostEstimate?: number | null;
 runAt: string;
 createdBy?: string | null;
 createdAt: string;
}
