import { BsfHarvestGrid } from "@/features/bsf/components/BsfHarvestGrid";

export default function BsfHarvestPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          BSF <span className="text-emerald-600">Harvests</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Review harvest outputs across batches.
        </p>
      </div>
      <BsfHarvestGrid />
    </div>
  );
}