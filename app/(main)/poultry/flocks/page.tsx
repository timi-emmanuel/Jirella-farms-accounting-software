import { PoultryFlockGrid } from "@/features/poultry/components/PoultryFlockGrid";

export default function PoultryFlocksPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Flocks</h1>
        <p className="text-slate-500 text-sm font-medium">
          Track batches, live bird counts, and lifecycle status.
        </p>
      </div>
      <PoultryFlockGrid />
    </div>
  );
}
