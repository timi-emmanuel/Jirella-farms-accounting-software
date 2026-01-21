import { ModuleInventoryGrid } from "@/features/inventory/components/ModuleInventoryGrid";
import { ModuleTransferRequestGrid } from "@/features/inventory/components/ModuleTransferRequestGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Warehouse } from "lucide-react";

export default function BsfProcurementPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          BSF <span className="text-emerald-600">Procurement</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Request PKC, poultry waste, and additives for BSF batches.
        </p>
      </div>
      <Tabs defaultValue="inventory" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-[360px] grid-cols-2">
            <TabsTrigger value="inventory">
              <Warehouse className="w-4 h-4 mr-2" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="history">
              <ClipboardList className="w-4 h-4 mr-2" />
              Request History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inventory" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <ModuleInventoryGrid moduleKey="BSF" />
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <ModuleTransferRequestGrid moduleKey="BSF" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
