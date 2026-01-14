import { ModuleInventoryGrid } from "@/features/inventory/components/ModuleInventoryGrid";
import { ModuleTransferRequestGrid } from "@/features/inventory/components/ModuleTransferRequestGrid";
import { ClipboardList, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InventoryPage() {
 return (
  <div className="h-full flex flex-col space-y-6">
   <div className="flex flex-col">
    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
     Inventory <span className="text-emerald-600">Store View</span>
    </h1>
    <p className="text-slate-500 text-sm font-medium">
     Monitor raw material stock levels, incoming purchases, and production usage/outflow.
    </p>
   </div>

  <Tabs defaultValue="inventory" className="flex-1 flex flex-col overflow-hidden">
   <div className="flex items-center justify-between mb-4">
    <TabsList className="grid w-[360px] grid-cols-2">
     <TabsTrigger value="inventory">
      <Warehouse className="w-4 h-4 mr-2" />
      Inventory
     </TabsTrigger>
     <TabsTrigger value="requests">
      <ClipboardList className="w-4 h-4 mr-2" />
      Requests
     </TabsTrigger>
    </TabsList>
   </div>

   <TabsContent value="inventory" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
    <ModuleInventoryGrid moduleKey="FEED_MILL" />
   </TabsContent>

   <TabsContent value="requests" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
    <ModuleTransferRequestGrid moduleKey="FEED_MILL" />
   </TabsContent>
  </Tabs>
 </div>
);
}
