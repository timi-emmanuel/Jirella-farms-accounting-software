import { CatfishPnlReportGrid } from "@/features/catfish/components/CatfishPnlReportGrid";
import { CatfishBatchPnlGrid } from "@/features/catfish/components/CatfishBatchPnlGrid";
import { ClipboardList, LayoutGrid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CatfishPnlReportPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">P&L Report</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Profitability per month and per batch.</p>
      </div>
      <Tabs defaultValue="monthly" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-[360px] grid-cols-2">
            <TabsTrigger value="monthly">
              <LayoutGrid className="w-4 h-4 mr-2" />
              Monthly
            </TabsTrigger>
            <TabsTrigger value="batch">
              <ClipboardList className="w-4 h-4 mr-2" />
              Batch
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="monthly" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <CatfishPnlReportGrid />
        </TabsContent>

        <TabsContent value="batch" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
          <CatfishBatchPnlGrid />
        </TabsContent>
      </Tabs>
    </div>
  );
}
