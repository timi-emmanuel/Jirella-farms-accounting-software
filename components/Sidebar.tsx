"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Home,
  Calculator,
  Users,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Package,
  Beaker,
  Factory,
  ShoppingCart,
  Settings,
  Menu,
  X,
  Truck, // New icon
  LayoutGrid, // New icon
  FlaskConical, // New icon
  Egg,
  Activity, // New icon
  ClipboardList,
  Wallet,
  Bug,
  Fish
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserRole } from "@/hooks/useUserRole"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { NAV_CONFIG, TabName } from "@/config/roles" // New import
import { UserRole } from "@/types"

interface NavigationItem { // Changed from type to interface
  name: TabName; // Updated type
  href: string;
  icon: any;
  subItems?: { name: string; href: string; icon: any }[];
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid }, // Icon changed
  {
    name: 'Feed Mill',
    href: '/feed-mill/dashboard', 
    icon: Factory,
    subItems: [
      { name: 'Dashboard', href: '/feed-mill/dashboard', icon: LayoutDashboard },
      { name: 'Inventory', href: '/feed-mill/rm-inventory', icon: Package },
      { name: 'Recipes', href: '/feed-mill/recipe-master', icon: FlaskConical }, 
      { name: 'Production', href: '/feed-mill/production', icon: Factory },
      { name: 'Finished Stock', href: '/feed-mill/stock', icon: Package },
      { name: 'Sales', href: '/feed-mill/sales', icon: ShoppingCart },
    ]
  },
  {
    name: 'Poultry',
    href: '/poultry/dashboard',
    icon: Egg,
    subItems: [
      { name: 'Dashboard', href: '/poultry/dashboard', icon: LayoutDashboard },
      { name: 'Flocks', href: '/poultry/flocks', icon: Users },
      { name: 'Daily Log', href: '/poultry/daily-log', icon: ClipboardList },
      { name: 'Inventory', href: '/poultry/inventory', icon: Package },
      { name: 'Sales', href: '/poultry/sales', icon: ShoppingCart },
      { name: 'Expenses', href: '/poultry/expenses', icon: Wallet },
    ]
  },
  {
    name: 'BSF',
    href: '/bsf/dashboard',
    icon: Bug,
    subItems: [
      { name: 'Dashboard', href: '/bsf/dashboard', icon: LayoutDashboard },
      { name: 'Procurement', href: '/bsf/procurement', icon: Truck },
      { name: 'Insectorium', href: '/bsf/insectorium', icon: ClipboardList },
      { name: 'Larvarium Batches', href: '/bsf/larvarium/batches', icon: Factory },
      { name: 'Harvest', href: '/bsf/harvest', icon: Package },
      { name: 'Processing', href: '/bsf/processing', icon: Beaker },
      { name: 'Sales', href: '/bsf/sales', icon: ShoppingCart },
      { name: 'P&L Report', href: '/bsf/reports/pnl', icon: Calculator },
      { name: 'Batch P&L', href: '/bsf/reports/batch-pnl', icon: Calculator },      
    ]
  },
  {
    name: 'Catfish',
    href: '/catfish/dashboard',
    icon: Fish,
    subItems: [
      { name: 'Dashboard', href: '/catfish/dashboard', icon: LayoutDashboard },
      { name: 'Ponds', href: '/catfish/ponds', icon: Activity },
      { name: 'Batches', href: '/catfish/batches', icon: ClipboardList },
      { name: 'Inventory', href: '/catfish/inventory', icon: Package },
      { name: 'Harvest', href: '/catfish/harvest', icon: Package },
      { name: 'Sales', href: '/catfish/sales', icon: ShoppingCart },
      { name: 'P&L Report', href: '/catfish/reports/pnl', icon: Calculator }
    ]
  },
  { name: 'Store', href: '/store', icon: Package },  
  { name: 'Procurement', href: '/procurement', icon: Truck }, 
  { name: 'Sales', href: '/sales', icon: ShoppingCart },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Activity Logs', href: '/activity-logs', icon: Activity },  
]

interface SidebarContentProps {
  pathname: string;
  openMenus: string[];
  toggleMenu: (name: string) => void;
  handleSignOut: () => Promise<void>;
  isAdmin: boolean;
  role: UserRole | null;
  onLinkClick?: () => void;
}

function SidebarContent({ pathname, openMenus, toggleMenu, handleSignOut, isAdmin, role, onLinkClick }: SidebarContentProps) {
  const isBsfSubItemAllowed = (subName: string) => {
    if (!role) return false;
    if (role === 'ADMIN') return true;
    if (role === 'BSF_STAFF') {
      return ['Dashboard', 'Insectorium', 'Larvarium Batches', 'Harvest', 'Processing', 'KPIs'].includes(subName);
    }
    if (role === 'ACCOUNTANT') {
      return ['Dashboard', 'Sales', 'P&L Report', 'Batch P&L'].includes(subName);
    }
    if (role === 'PROCUREMENT_MANAGER') {
      return ['Procurement'].includes(subName);
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f0d] text-slate-300 w-full">
      <div className="flex h-20 items-center px-6 border-b border-white/5 shrink-0">
        <div className="flex flex-col">
          <span className="text-xl font-black text-white tracking-tighter font-manrope">
            JIRELLA <span className="text-emerald-500">FARMS</span>
          </span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold -mt-1">
            {role || 'Management System'}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          // Check if user has access to this top-level tab
          if (role && !NAV_CONFIG[role]?.includes(item.name)) return null;

          // Special case logic for specific items can remain if needed, but NAV_CONFIG is primary source
          if (item.name === 'Users' && !isAdmin) return null;

          const isActive = pathname === item.href;
          const isOpen = openMenus.includes(item.name);
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.name} className="space-y-1">
              {hasSubItems ? (
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={cn(
                    "w-full group flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200",
                    isOpen ? "text-white bg-white/5" : "hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon className={cn("mr-3 h-4 w-4 transition-colors", isOpen ? "text-emerald-500" : "text-slate-500 group-hover:text-emerald-400")} />
                    {item.name}
                  </div>
                  {isOpen ? <ChevronDown className="h-3 w-3 opacity-50" /> : <ChevronRight className="h-3 w-3 opacity-50" />}
                </button>
              ) : (
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20"
                      : "hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className={cn("mr-3 h-4 w-4 transition-colors", isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-emerald-400")} />
                  {item.name}
                </Link>
              )}

              {hasSubItems && isOpen && (
                <div className="ml-4 pl-4 border-l border-white/5 space-y-1 my-1">
                  {item.subItems!.map((sub) => {
                    // Hide Recipes for non-admins
                    if (sub.name === 'Recipes' && !isAdmin) return null;
                    if (item.name === 'BSF' && !isBsfSubItemAllowed(sub.name)) return null;
                    // Logic to hide Sales if not accountant/admin? 
                    // For now, let's keep sub-items visible if parent is visible, or add sub-item config.

                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.name}
                        href={sub.href}
                        onClick={onLinkClick}
                        className={cn(
                          "group flex items-center px-3 py-2 text-xs font-medium rounded-md transition-all",
                          isSubActive
                            ? "text-emerald-400 bg-emerald-500/5"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <sub.icon className={cn("mr-2.5 h-3.5 w-3.5", isSubActive ? "text-emerald-400" : "text-slate-500 group-hover:text-white")} />
                        {sub.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-4 shrink-0">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg text-slate-400 hover:bg-destructive/10 hover:text-destructive transition-all group"
        >
          <LogOut className="h-4 w-4 text-slate-500 group-hover:text-destructive transition-colors" />
          Sign Out
        </button>

        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">System Version</span>
            <span className="text-[10px] text-slate-500 font-mono">v0.1.2 Build Final</span>
          </div>
          <Settings className="w-3.5 h-3.5 text-slate-700 hover:text-slate-500 cursor-pointer transition-colors" />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const getOpenMenusForPath = (path: string) => {
    const matches = navigation.filter((item) => {
      if (!item.subItems || item.subItems.length === 0) return false;
      return item.subItems.some((sub) => path === sub.href || path.startsWith(`${sub.href}/`)) ||
        path === item.href || path.startsWith(`${item.href}/`);
    });
    return matches.map((item) => item.name);
  };

  const [openMenus, setOpenMenus] = useState<string[]>(() => getOpenMenusForPath(pathname));
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { role, loading, isAdmin } = useUserRole();
  const router = useRouter();

  const toggleMenu = (name: string) => {
    setOpenMenus(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
  }

  useEffect(() => {
    const nextOpen = getOpenMenusForPath(pathname);
    if (nextOpen.length > 0) {
      setOpenMenus(nextOpen);
    }
  }, [pathname]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) return (
    <>
      <div className="hidden md:block w-64 bg-[#0a0f0d] h-full shadow-xl"></div>
      <div className="md:hidden h-14 bg-[#0a0f0d]"></div>
    </>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="bg-[#0a0f0d] text-white p-2 rounded-lg shadow-lg border border-white/10"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[#0a0f0d] shadow-2xl animate-in slide-in-from-left duration-300">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-6 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent
              pathname={pathname}
              openMenus={openMenus}
              toggleMenu={toggleMenu}
              handleSignOut={handleSignOut}
              isAdmin={isAdmin}
              role={role}
              onLinkClick={() => setIsMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full w-64 shrink-0 shadow-2xl z-20 border-r border-white/5 bg-[#0a0f0d]">
        <SidebarContent
          pathname={pathname}
          openMenus={openMenus}
          toggleMenu={toggleMenu}
          handleSignOut={handleSignOut}
          isAdmin={isAdmin}
          role={role}
        />
      </div>
    </>
  )
}
