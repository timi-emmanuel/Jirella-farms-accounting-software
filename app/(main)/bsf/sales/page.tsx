import { BsfSalesGrid } from "@/features/bsf/components/BsfSalesGrid";

export default function BsfSalesPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          BSF <span className="text-emerald-600">Sales</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Sell BSF products and link revenue to batches.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BsfSalesGrid />
      </div>
    </div>
  );
}