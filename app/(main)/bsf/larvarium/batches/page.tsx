import { BsfLarvariumBatchGrid } from "@/features/bsf/components/BsfLarvariumBatchGrid";

export default function BsfLarvariumBatchesPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Larvarium <span className="text-emerald-600">Batches</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Create and monitor BSF production batches.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BsfLarvariumBatchGrid />
      </div>
    </div>
  );
}