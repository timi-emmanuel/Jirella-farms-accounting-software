import { ProcurementGrid } from "@/features/procurement/components/ProcurementGrid";
import { Truck } from "lucide-react";

export default function ProcurementPage() {
 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
    <p className="text-sm text-gray-400">
     <Truck className="w-4 h-4 mr-1 inline" />
     Review and approve supply requests
    </p>
   </div>
   <div className="flex-1 overflow-hidden">
    <ProcurementGrid />
   </div>
  </div>
 );
}
