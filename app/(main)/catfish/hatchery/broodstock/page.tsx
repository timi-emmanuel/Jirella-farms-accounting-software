import { CatfishBroodstockLogGrid } from "@/features/catfish/components/CatfishBroodstockLogGrid";

export default function CatfishHatcheryBroodstockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish Hatchery <span className="text-emerald-600">Broodstock Logs</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Track broodstock feeding and mortality records.</p>
      </div>
      <CatfishBroodstockLogGrid />
    </div>
  );
}
