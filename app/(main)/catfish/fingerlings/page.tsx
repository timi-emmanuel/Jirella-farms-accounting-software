import { CatfishBatchGrid } from "@/features/catfish/components/CatfishBatchGrid";
import { Info, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CatfishFingerlingsPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Catfish <span className="text-emerald-600">Fingerlings Batch Operations</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Manage fingerlings batches and track production.
          </p>
          <p className="text-emerald-700 text-xs font-semibold mt-2 animate-pulse">
            <Info className="inline mr-1" size={12} />
            Click any batch name in the table to open its full details.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/catfish/fingerlings/dashboard">
            <Button variant="outline" size="sm" className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
      <CatfishBatchGrid productionType="Fingerlings" basePath="/catfish/fingerlings" stageLabel="Fingerlings" />
    </div>
  );
}
