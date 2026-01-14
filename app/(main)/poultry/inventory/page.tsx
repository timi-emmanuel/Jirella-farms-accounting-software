import { ModuleInventoryGrid } from "@/features/inventory/components/ModuleInventoryGrid";

export default function PoultryInventoryPage() {
 return (
  <div className="flex flex-col h-full space-y-6">
   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">
     Poultry Inventory <span className="text-emerald-600">Store View</span>
    </h1>
   </div>
   <ModuleInventoryGrid moduleKey="POULTRY" />
  </div>
 );
}
