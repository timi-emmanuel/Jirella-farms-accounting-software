import { StoreRequestGrid } from "@/features/store/components/StoreRequestGrid";
import { Package } from "lucide-react";

export default function StorePage() {
 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">Store Management</h1>
    <p className="text-sm text-gray-400">
     <Package className="w-4 h-4 mr-1 inline" />
     Manage inventory requests and stock
    </p>
   </div>
   <div className="flex-1 overflow-hidden">
    <StoreRequestGrid />
   </div>
  </div>
 );
}
