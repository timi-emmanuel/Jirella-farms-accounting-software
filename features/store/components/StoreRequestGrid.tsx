'use client';

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 ModuleRegistry,
 CellStyleModule,
 ClientSideRowModelModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule,
 themeQuartz
} from 'ag-grid-community';
import { toast } from "@/lib/toast";
import { Loader2, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";

// Register modules
ModuleRegistry.registerModules([
 ClientSideRowModelModule,
 CellStyleModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule
]);

type StoreRequestRow = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  requestDate?: string | null;
  unitCost?: number | null;
  totalCost?: number | null;
  purpose?: string | null;
  status: string;
  createdAt: string;
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
};

export function StoreRequestGrid() {
 const [rowData, setRowData] = useState<StoreRequestRow[]>([]);
 const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [showNewRequest, setShowNewRequest] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // New Request State
 const [newItem, setNewItem] = useState({
  itemName: '',
  quantity: '',
  unit: 'KG',
  requestDate: new Date().toISOString().slice(0, 10),
  unitCost: '',
  purpose: ''
 });

 const computedTotalCost = useMemo(() => {
  const qty = Number(newItem.quantity);
  const cost = Number(newItem.unitCost);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!Number.isFinite(cost) || cost < 0) return 0;
  return qty * cost;
 }, [newItem.quantity, newItem.unitCost]);

 const colDefs = useMemo<ColDef<StoreRequestRow>[]>(() => [
  {
   field: "itemName",
   headerName: "Item Name",
   flex: 1.5,
   minWidth: 150,
   filter: true
  },
  {
   field: "quantity",
   headerName: "Quantity",
   flex: 0.8,
   filter: false,
   type: 'numericColumn'
  },
  {
   field: "unit",
   headerName: "Unit",
   width: 100,
   filter: false
  },
  {
   field: "unitCost",
   headerName: "Unit Cost",
   width: 120,
   type: 'numericColumn',
   valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   field: "totalCost",
   headerName: "Total Cost",
   width: 130,
   type: 'numericColumn',
   valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   field: "purpose",
   headerName: "Purpose / Notes",
   flex: 2,
   minWidth: 200,
   filter: false
  },
  {
   field: "status",
   headerName: "Status",
   width: 120,
   cellRenderer: (params: any) => {
    const status = params.value;
    let colorClass = 'bg-slate-100 text-slate-600';
    if (status === 'PENDING') colorClass = 'bg-amber-100 text-amber-700';
    if (status === 'APPROVED') colorClass = 'bg-emerald-100 text-emerald-700';
    if (status === 'REJECTED') colorClass = 'bg-rose-100 text-rose-700';
    if (status === 'RECEIVED') colorClass = 'bg-blue-100 text-blue-700';

    return (
     <span className={`px-2 py-1 rounded-full text-xs font-bold ${colorClass}`}>
      {status}
     </span>
    );
   }
  },
  {
   field: "requestDate",
   headerName: "Date Requested",
   flex: 1,
   valueFormatter: (p: any) => {
    const source = p.value || p.data?.createdAt;
    if (!source) return '';
    return new Date(source).toLocaleDateString('en-GB').replace(/\//g, '-');
   },
   sort: 'desc'
  }
 ], []);

 const loadData = async () => {
  setLoading(true);
  const response = await fetch('/api/store/requests');
  const payload = await response.json().catch(() => ({}));
 if (!response.ok) {
   const message = payload.error || response.statusText;
   console.error('Error loading store requests:', message);
   toast({
    title: "Error",
    description: `Failed to load store requests: ${message}`,
    variant: "destructive"
   });
  } else {
   setRowData(payload.requests || []);
  }
  setLoading(false);
 };

 const loadInventoryItems = async () => {
  const response = await fetch('/api/inventory/location?code=STORE');
  const payload = await response.json().catch(() => ({}));
 if (!response.ok) {
   const message = payload.error || response.statusText;
   console.error('Error loading inventory items:', message);
   toast({
    title: "Error",
    description: `Failed to load inventory items: ${message}`,
    variant: "destructive"
   });
   return;
  }
  setInventoryItems(payload.items || []);
 };

 const handleCreateRequest = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  const response = await fetch('/api/store/requests', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    itemName: newItem.itemName,
    quantity: Number(newItem.quantity),
    unit: newItem.unit,
    requestDate: newItem.requestDate,
    unitCost: Number(newItem.unitCost),
    totalCost: computedTotalCost,
    purpose: newItem.purpose
   })
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: "Failed to create request: " + (payload.error || response.statusText),
    variant: "destructive"
   });
  } else {
   setShowNewRequest(false);
   setNewItem({
    itemName: '',
    quantity: '',
    unit: 'KG',
    requestDate: new Date().toISOString().slice(0, 10),
    unitCost: '',
    purpose: ''
   });
   toast({
    title: "Success",
    description: "Store request submitted successfully.",
    variant: "success"
   });
   loadData();
  }
  setSubmitting(false);
 };

 useEffect(() => {
  loadData();
  loadInventoryItems();
 }, []);

 if (loading && rowData.length === 0) return (
  <div className="flex items-center justify-center h-full">
   <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
  </div>
 );

 return (
  <div className="flex flex-col h-full space-y-4">
   <div className="flex justify-end">
    <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
     <DialogTrigger asChild>
      <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-sm transition-all  active:scale-95">
       <Plus className="w-4 h-4 mr-2" />
       New Store Request
      </Button>
     </DialogTrigger>
     <DialogContent className="sm:max-w-106.25">
      <DialogHeader>
       <DialogTitle>New Store Request</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleCreateRequest} className="space-y-4 py-4">
       <div className="space-y-2">
        <Label>Item</Label>
        <Select
         value={newItem.itemName}
         onValueChange={(value) => {
          const selected = inventoryItems.find(item => item.name === value);
          setNewItem({
           ...newItem,
           itemName: value,
           unit: selected?.unit ?? newItem.unit
          });
         }}
        >
         <SelectTrigger>
          <SelectValue placeholder="Select item" />
         </SelectTrigger>
         <SelectContent>
          {inventoryItems.map(item => (
           <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
          ))}
         </SelectContent>
        </Select>
       </div>
       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
         <Label htmlFor="qty">Quantity</Label>
         <Input
          id="qty"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={newItem.quantity}
          onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
          required
         />
        </div>
        <div className="space-y-2">
         <Label>Unit</Label>
         <Input value={newItem.unit} readOnly />
        </div>
       </div>
       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
         <Label htmlFor="requestDate">Date</Label>
         <Input
          id="requestDate"
          type="date"
          value={newItem.requestDate}
          onChange={e => setNewItem({ ...newItem, requestDate: e.target.value })}
          required
         />
        </div>
        <div className="space-y-2">
         <Label htmlFor="unitCost">Unit Cost</Label>
         <Input
          id="unitCost"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={newItem.unitCost}
          onChange={e => setNewItem({ ...newItem, unitCost: e.target.value })}
          required
         />
        </div>
       </div>
       <div className="space-y-2">
        <Label htmlFor="totalCost">Total Cost</Label>
        <Input
         id="totalCost"
         type="number"
         step="0.01"
         value={computedTotalCost.toFixed(2)}
         readOnly
        />
       </div>
       <div className="space-y-2">
        <Label htmlFor="purpose">Purpose / Notes</Label>
        <Textarea
         id="purpose"
         placeholder="Why is this needed?"
         value={newItem.purpose}
         onChange={e => setNewItem({ ...newItem, purpose: e.target.value })}
        />
       </div>
       <DialogFooter>
        <Button type="submit" disabled={submitting} className="bg-emerald-700 w-full">
         {submitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
         Submit Request
        </Button>
       </DialogFooter>
      </form>
     </DialogContent>
    </Dialog>
   </div>

   <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm ag-theme-quartz">
    {rowData.length === 0 ? (
     <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <Package className="w-12 h-12 mb-2 opacity-20" />
      <p>No requests found</p>
     </div>
    ) : (
     <AgGridReact
      rowData={rowData}
      columnDefs={colDefs}
      defaultColDef={{
       sortable: true,
       resizable: true,
      }}
      pagination={true}
      paginationPageSize={20}
      theme={themeQuartz}
     />
    )}
   </div>
  </div>
 );
}


