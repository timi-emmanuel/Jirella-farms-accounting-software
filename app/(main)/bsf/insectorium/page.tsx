import { BsfInsectoriumLogGrid } from "@/features/bsf/components/BsfInsectoriumLogGrid";

export default function BsfInsectoriumPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Insectorium <span className="text-emerald-600">Logs</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Track daily breeding inputs and egg yields.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <BsfInsectoriumLogGrid />
      </div>
    </div>
  );
}