import { CatfishBatchGrid } from "@/features/catfish/components/CatfishBatchGrid";

export default function CatfishBatchesPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Batches</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Track stocked ponds and production cycles.</p>
      </div>
      <CatfishBatchGrid />
    </div>
  );
}
