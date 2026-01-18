import { BsfBatchPnlGrid } from "@/features/bsf/components/BsfBatchPnlGrid";

export default function BsfBatchPnlPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          BSF <span className="text-emerald-600">Batch P&L</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Profitability per larvarium batch.
        </p>
      </div>
      <BsfBatchPnlGrid />
    </div>
  );
}