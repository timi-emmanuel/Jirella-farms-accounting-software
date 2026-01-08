"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
  Settings
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserRole } from "@/hooks/useUserRole"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

type NavigationItem = {
  name: string
  href: string
  icon: any
  subItems?: { name: string; href: string; icon: any }[]
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Feed Mill',
    href: '#',
    icon: Factory, // Changed to Factory for better context
    subItems: [
      { name: 'Inventory', href: '/feed-mill/rm-inventory', icon: Package },
      { name: 'Recipes Master', href: '/feed-mill/recipe-master', icon: Beaker },
      { name: 'Production', href: '/feed-mill/production', icon: Factory },
      { name: 'Sales', href: '/feed-mill/sales', icon: ShoppingCart },
    ]
  },
  { name: 'Poultry', href: '/poultry', icon: Home },
  { name: 'Users', href: '/admin/users', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>(['Feed Mill']);
  const { role, loading, isAdmin } = useUserRole();
  const router = useRouter();

  const toggleMenu = (name: string) => {
    setOpenMenus(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) return <div className="w-64 bg-[#0a0f0d] h-full shadow-xl"></div>;

  return (
    <div className="flex h-full flex-col bg-[#0a0f0d] text-slate-300 w-64 shadow-2xl z-20 border-r border-white/5 custom-scrollbar">
      <div className="flex h-20 items-center px-6 border-b border-white/5">
        <div className="flex flex-col">
          <span className="text-xl font-black text-white tracking-tighter">
            JIRELLA <span className="text-emerald-500">FARMS</span>
          </span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold -mt-1">
            {role || 'Management System'}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
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

                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.name}
                        href={sub.href}
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

      <div className="p-4 border-t border-white/5 space-y-4">
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
  )
}
