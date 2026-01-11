
import { UserRole } from "@/types";

export const ROLES: Record<string, UserRole> = {
 ADMIN: 'ADMIN',
 MANAGER: 'MANAGER',
 ID_CREATOR: 'ID_CREATOR',
 FEED_MILL: 'FEED_MILL_STAFF',
 POULTRY: 'POULTRY_STAFF',
 ACCOUNTANT: 'ACCOUNTANT',
 PROCUREMENT: 'PROCUREMENT_MANAGER',
 STORE: 'STORE_KEEPER',
 STAFF: 'STAFF'
};

// Define available tabs
export type TabName = 'Dashboard' | 'Feed Mill' | 'Poultry' | 'Store' | 'Procurement' | 'Users' | 'Reports' | 'Sales';

// Configure which roles can access which tabs
export const NAV_CONFIG: Record<UserRole, TabName[]> = {
 ADMIN: ['Dashboard', 'Feed Mill', 'Poultry', 'Store', 'Procurement', 'Users', 'Reports', 'Sales'],
 MANAGER: ['Dashboard', 'Feed Mill', 'Poultry', 'Store', 'Procurement', 'Reports', 'Sales'],
 ID_CREATOR: ['Users'], // Assuming this role is just for creating IDs
 FEED_MILL_STAFF: ['Dashboard', 'Feed Mill', 'Sales'],
 POULTRY_STAFF: ['Dashboard', 'Poultry'],
 ACCOUNTANT: ['Dashboard', 'Feed Mill', 'Poultry', 'Sales', 'Reports'],
 PROCUREMENT_MANAGER: ['Dashboard', 'Procurement', 'Store'],
 STORE_KEEPER: ['Dashboard', 'Store'],
 STAFF: ['Dashboard'], // Default access
};

// Helper to check if a specific tab is allowed for a user role
export const isTabAllowed = (role: UserRole | null | undefined, tab: TabName): boolean => {
 if (!role) return false;
 const allowedTabs = NAV_CONFIG[role] || [];
 return allowedTabs.includes(tab);
};
