import { CatfishPondGrid } from "@/features/catfish/components/CatfishPondGrid";

export default function CatfishPondsPage() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Catfish <span className="text-emerald-600">Ponds</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium">Register ponds and capacity.</p>
      </div>
      <CatfishPondGrid />
    </div>
  );
}
