import { CatfishFeedStockGrid } from "@/features/catfish/components/CatfishFeedStockGrid";
import { CatfishFeedPurchaseGrid } from "@/features/catfish/components/CatfishFeedPurchaseGrid";
import { ClipboardList, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CatfishInventoryPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Inventory</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Feed stock and internal purchases.</p>
      </div>
      <Tabs defaultValue="stock" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-[360px] grid-cols-2">
            <TabsTrigger value="stock">
              <Warehouse className="w-4 h-4 mr-2" />
              Feed Stock
            </TabsTrigger>
            <TabsTrigger value="purchases">
              <ClipboardList className="w-4 h-4 mr-2" />
              Purchases
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stock" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <CatfishFeedStockGrid />
        </TabsContent>

        <TabsContent value="purchases" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <CatfishFeedPurchaseGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
}
