import { CatfishBroodstockLogGrid } from "@/features/catfish/components/CatfishBroodstockLogGrid";

export default function CatfishHatcheryBroodstockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Broodstock Feeding & Mortality</h2>
        <p className="text-slate-500 text-sm">Daily tracking and health monitoring records.</p>
      </div>
      <CatfishBroodstockLogGrid />
    </div>
  );
}
