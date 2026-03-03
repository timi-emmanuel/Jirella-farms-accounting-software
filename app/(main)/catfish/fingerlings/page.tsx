import { CatfishBatchGrid } from "@/features/catfish/components/CatfishBatchGrid";
import { Info } from "lucide-react";

export default function CatfishFingerlingsPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Fingerlings</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Batch list for fingerlings production.
        </p>
        <p className="text-emerald-700 text-xs font-semibold mt-2 animate-pulse">
          <Info className="inline mr-1" size={12} />
           Click any batch name in the table to open its full details.
        </p>
      </div>
      <CatfishBatchGrid productionType="Fingerlings" basePath="/catfish/fingerlings" stageLabel="Fingerlings" />
    </div>
  );
}
