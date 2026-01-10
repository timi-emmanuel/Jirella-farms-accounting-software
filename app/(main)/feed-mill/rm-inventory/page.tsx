import { InventoryGrid } from "@/features/feed-mill/components/InventoryGrid";

export default function InventoryPage() {
 return (
  <div className="h-full flex flex-col space-y-6">
   <div className="flex flex-col">
    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
     Inventory <span className="text-emerald-600">Ledger</span>
    </h1>
    <p className="text-slate-500 text-sm font-medium">
     Monitor raw material stock levels, incoming purchases, and production usage/outflow.
    </p>
   </div>

   <div className="flex-1 overflow-hidden">
    <InventoryGrid />
   </div>
  </div>
 );
}
