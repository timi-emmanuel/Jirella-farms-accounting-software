import Link from "next/link"
import { Home, List, Calculator, Settings, Users } from "lucide-react" // Examples
import { cn } from "@/lib/utils"

const navigation = [
 { name: 'Dashboard', href: '/dashboard', icon: Home },
 { name: 'Feed Mill', href: '/dashboard/feed-mill/recipe-master', icon: Calculator },
 { name: 'Inventory', href: '/dashboard/feed-mill/rm-inventory', icon: List },
 { name: 'Poultry', href: '/dashboard/poultry', icon: List }, // Placeholder
 { name: 'Users', href: '/dashboard/admin/users', icon: Users },
]

export function Sidebar() {
 return (
  <div className="flex h-full flex-col bg-slate-900 text-white w-64">
   <div className="flex h-16 items-center px-6 font-bold text-xl">
    FarmMS
   </div>
   <nav className="flex-1 space-y-1 px-2 py-4">
    {navigation.map((item) => (
     <Link
      key={item.name}
      href={item.href}
      className={cn(
       "group flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-800"
      )}
     >
      <item.icon className="mr-3 h-6 w-6 text-slate-400 group-hover:text-white" />
      {item.name}
     </Link>
    ))}
   </nav>
   <div className="p-4 border-t border-slate-800">
    <div className="text-xs text-slate-500">v0.1.0 MVP</div>
   </div>
  </div>
 )
}
