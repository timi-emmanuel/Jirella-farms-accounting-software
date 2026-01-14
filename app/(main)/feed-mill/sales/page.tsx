import Link from "next/link";
import { SalesGrid } from "@/features/sales/components/SalesGrid";
import { Button } from "@/components/ui/button";

export default function SalesPage() {
 return (
  <div className="h-full flex flex-col space-y-6">
   <div className="flex flex-col">
    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
     Feed Mill <span className="text-emerald-600">Sales</span>
    </h1>
    <p className="text-slate-500 text-sm font-medium">
     View feed mill sales within the unified sales system.
    </p>
   </div>
   <div className="flex justify-end">
    <Button asChild variant="outline">
     <Link href="/sales">Go to Unified Sales</Link>
    </Button>
   </div>

   <div className="flex-1 overflow-hidden">
    <SalesGrid initialModule="FEED_MILL" />
   </div>
  </div>
 );
}
