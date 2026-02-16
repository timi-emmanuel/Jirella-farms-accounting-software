import { StoreRequestGrid } from "@/features/store/components/StoreRequestGrid";
import { IssueRequestGrid } from "@/features/store/components/IssueRequestGrid";
import { InventoryGrid } from "@/features/store/components/InventoryGrid";
import { StoreHistoryGrid } from "@/features/store/components/StoreHistoryGrid";
import { Package, ClipboardList, Warehouse, PackageCheck, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StorePage() {
 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <div>
     <h1 className="text-2xl font-bold tracking-tight">Store Management</h1>
     <p className="text-sm text-gray-400">
      <Package className="w-4 h-4 mr-1 inline" />
      Manage inventory and store requests
     </p>
    </div>
   </div>

   <Tabs defaultValue="inventory" className="flex-1 flex flex-col overflow-hidden">
   <div className="flex items-center justify-between mb-4">
     <TabsList className="grid w-[52rem] grid-cols-4">
      <TabsTrigger value="inventory">
       <Warehouse className="w-4 h-4 mr-2" />
       Inventory
      </TabsTrigger>
      <TabsTrigger value="history">
       <History className="w-4 h-4 mr-2" />
       History
      </TabsTrigger>
      <TabsTrigger value="requests">
       <ClipboardList className="w-4 h-4 mr-2" />
       Procurement
      </TabsTrigger>
      <TabsTrigger value="issue-requests">
       <PackageCheck className="w-4 h-4 mr-2" />
       Transfer Requests
      </TabsTrigger>
     </TabsList>
    </div>

    <TabsContent value="inventory" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
     <InventoryGrid />
    </TabsContent>

    <TabsContent value="history" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
     <StoreHistoryGrid />
    </TabsContent>

    <TabsContent value="requests" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
     <StoreRequestGrid />
    </TabsContent>

    <TabsContent value="issue-requests" className="flex-1 overflow-hidden mt-0 border-0 p-0 data-[state=inactive]:hidden h-full">
     <IssueRequestGrid />
    </TabsContent>
   </Tabs>
  </div>
 );
}
