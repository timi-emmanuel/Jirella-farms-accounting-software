import { CatfishFeedStockGrid } from "@/features/catfish/components/CatfishFeedStockGrid";
import { CatfishFeedPurchaseGrid } from "@/features/catfish/components/CatfishFeedPurchaseGrid";
import { ClipboardList, Warehouse, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type CatfishInventoryStage = "hatchery" | "fingerlings" | "juvenile" | "growout";

const stageLabels: Record<CatfishInventoryStage, string> = {
  hatchery: "Hatchery",
  fingerlings: "Fingerlings",
  juvenile: "Juvenile",
  growout: "Grow-out",
};

export function CatfishInventoryView({ stage }: { stage: CatfishInventoryStage }) {
  const stageLabel = stageLabels[stage];

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">{stageLabel} Inventory</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Stage-specific feed stock and internal purchases.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href={`/catfish/${stage}/dashboard`}>
          <Button variant="outline" size="sm" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="stock" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-90 grid-cols-2">
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
          <CatfishFeedStockGrid stage={stage} />
        </TabsContent>

        <TabsContent value="purchases" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <CatfishFeedPurchaseGrid stage={stage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
