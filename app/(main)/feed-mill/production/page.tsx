import { ProductionGrid } from "@/features/feed-mill/components/ProductionGrid";

export default function ProductionPage() {
 return (
  <div className="h-full flex flex-col space-y-6">
   <div className="flex flex-col">
    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
     Feed <span className="text-emerald-600">Production</span>
    </h1>
    <p className="text-slate-500 text-sm font-medium">
     Log feed production runs, calculate ingredient requirements, and monitor production costs.
    </p>
   </div>

   <div className="flex-1 overflow-hidden">
    <ProductionGrid />
   </div>
  </div>
 );
}
