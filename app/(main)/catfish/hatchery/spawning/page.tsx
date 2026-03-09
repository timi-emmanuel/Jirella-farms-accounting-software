import { CatfishSpawningEventGrid } from "@/features/catfish/components/CatfishSpawningEventGrid";

export default function CatfishHatcherySpawningPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Spawning Operations & Incubation</h2>
        <p className="text-slate-500 text-sm">Track spawning events, hormone costs, and incubation status.</p>
      </div>
      <CatfishSpawningEventGrid />
    </div>
  );
}
