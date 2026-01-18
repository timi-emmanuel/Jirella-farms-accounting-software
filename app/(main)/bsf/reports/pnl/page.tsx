import { BsfPnlReportGrid } from "@/features/bsf/components/BsfPnlReportGrid";

export default function BsfPnlReportPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          BSF <span className="text-emerald-600">P&L Report</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Monthly profitability view for BSF operations.
        </p>
      </div>
      <BsfPnlReportGrid />
    </div>
  );
}