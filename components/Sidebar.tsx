"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, List, Calculator, Users, ChevronDown, ChevronRight, LayoutDashboard, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserRole } from "@/hooks/useUserRole"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"


type NavigationItem = {
 name: string
 href: string
 icon: any
 subItems?: { name: string; href: string }[]
}

const navigation: NavigationItem[] = [
 { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
 {
  name: 'Feed Mill',
  href: '#',
  icon: Calculator,
  subItems: [
   { name: 'Recipe Master', href: '/feed-mill/recipe-master' },
   { name: 'RM Inventory', href: '/feed-mill/rm-inventory' },
   { name: 'Sales', href: '/feed-mill/sales' },
   { name: 'Production', href: '/feed-mill/production' }
  ]
 },
 { name: 'Poultry', href: '/poultry', icon: Home },
 { name: 'Users', href: '/admin/users', icon: Users },
 { name: 'Sign Out', href: '/login', icon: LogOut }
]

export function Sidebar() {
 const pathname = usePathname();
 const [openMenus, setOpenMenus] = useState<string[]>(['Feed Mill']); // Default open
 const { role, loading, isAdmin } = useUserRole();

 const toggleMenu = (name: string) => {
  setOpenMenus(prev =>
   prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
  )
 }

 const router = useRouter();

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const handleSignOut = async () => {
  await supabase.auth.signOut();
  router.replace("/login");
};


 if (loading) return <div className="w-64 bg-slate-900 h-full"></div>; 

 return (
  <div className="flex h-full flex-col bg-slate-900 text-white w-64">
   <div className="flex h-16 items-center px-6 font-bold text-base border-b border-slate-800">
    Jirella Farms <span className="ml-2 text-xs bg-green-500 px-1 py-0 rounded-full text-slate-800">{role || '...'}</span>
   </div>
   <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
    {navigation.map((item) => {
     // Hide Users tab if not Admin
     if (item.name === 'Users' && !isAdmin) return null;

     const isActive = pathname === item.href;
     const isOpen = openMenus.includes(item.name);
     const hasSubItems = item.subItems && item.subItems.length > 0;

     return (
      <div key={item.name}>
       {hasSubItems ? (
        <button
         onClick={() => toggleMenu(item.name)}
         className={cn(
          "w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md cursor-pointer hover:bg-slate-800 text-slate-300 hover:text-white"
         )}
        >
         <div className="flex items-center">
          <item.icon className="mr-3 h-5 w-5 text-slate-400  group-hover:text-white" />
          {item.name}
         </div>
         {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
       ) : (
        <Link
         href={item.href}
         className={cn(
          "group flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-800",
          isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:text-white"
         )}
        >
         <item.icon className={cn("mr-3 h-5 w-5", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
         {item.name}
        </Link>
       )}

       {hasSubItems && isOpen && (
        <div className="ml-8 space-y-1 mt-1">
         {item.subItems!.map((sub) => {
          const isSubActive = pathname === sub.href;
          return (
           <Link
            key={sub.name}
            href={sub.href}
            className={cn(
             "block px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-800",
             isSubActive ? "text-white bg-slate-800" : "text-slate-400 hover:text-white"
            )}
           >
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
   <div className="p-4 border-t border-slate-800 space-y-3">
    <button
      onClick={handleSignOut}
      className="w-full flex items-center gap-3 px-2 py-2 text-sm font-medium rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
    >
      <LogOut className="h-5 w-5 text-slate-400 group-hover:text-white" />
      Sign Out
    </button>

   <div className="text-xs text-slate-500">v0.1.0 MVP</div>
</div>

  </div>
 )
}
