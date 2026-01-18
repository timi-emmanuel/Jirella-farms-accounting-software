
import { UserRole } from "@/types";

export const ROLES: Record<string, UserRole> = {
 ADMIN: 'ADMIN',
  FEED_MILL: 'FEED_MILL_STAFF',
  BSF: 'BSF_STAFF',
 POULTRY: 'POULTRY_STAFF',
 ACCOUNTANT: 'ACCOUNTANT',
 PROCUREMENT: 'PROCUREMENT_MANAGER',
 STORE: 'STORE_KEEPER',
};

// Define available tabs
export type TabName = 'Dashboard' | 'Feed Mill' | 'BSF' | 'Poultry' | 'Store' | 'Procurement' | 'Users' | 'Activity Logs' | 'Sales';

// Configure which roles can access which tabs
export const NAV_CONFIG: Partial<Record<UserRole, TabName[]>> = {
 ADMIN: ['Dashboard', 'Feed Mill', 'BSF', 'Poultry', 'Store', 'Procurement', 'Users', 'Activity Logs', 'Sales'],
 FEED_MILL_STAFF: ['Dashboard', 'Feed Mill', 'Sales'],
 BSF_STAFF: ['Dashboard', 'BSF'],
 POULTRY_STAFF: ['Dashboard', 'Poultry'],
 ACCOUNTANT: ['Dashboard', 'Feed Mill', 'BSF', 'Poultry', 'Sales'],
 PROCUREMENT_MANAGER: ['Dashboard', 'Procurement', 'Store', 'BSF'],
 STORE_KEEPER: ['Dashboard', 'Store'],
};

// Helper to check if a specific tab is allowed for a user role
export const isTabAllowed = (role: UserRole | null | undefined, tab: TabName): boolean => {
 if (!role) return false;
 const allowedTabs = NAV_CONFIG[role] || [];
 return allowedTabs.includes(tab);
};
