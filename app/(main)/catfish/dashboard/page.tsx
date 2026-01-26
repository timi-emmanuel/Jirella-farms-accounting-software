import { CatfishDashboard } from "@/features/catfish/components/CatfishDashboard";

export default function CatfishDashboardPage() {
  return (
    <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Dashboard</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Batch performance, survival, and sales visibility.
        </p>
      </div>
      <CatfishDashboard />
    </div>
  );
}
