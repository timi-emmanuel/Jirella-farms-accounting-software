import { CatfishSpawningEventGrid } from "@/features/catfish/components/CatfishSpawningEventGrid";

export default function CatfishHatcherySpawningPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish Hatchery <span className="text-emerald-600">Spawning Events</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Track spawning operations and incubation status.</p>
      </div>
      <CatfishSpawningEventGrid />
    </div>
  );
}
