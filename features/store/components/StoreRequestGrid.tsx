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
import { Loader2, Plus, Package, CheckCircle } from 'lucide-react';
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
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

type ProcurementLine = {
  item?: { name?: string; unit?: string };
  quantityRequested: number;
};

type ProcurementRequestRow = {
  id: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  lines?: ProcurementLine[];
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
};

export function StoreRequestGrid() {
 const [rowData, setRowData] = useState<ProcurementRequestRow[]>([]);
 const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [showNewRequest, setShowNewRequest] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
 const [requestToReceive, setRequestToReceive] = useState<ProcurementRequestRow | null>(null);
 const [isReceiving, setIsReceiving] = useState(false);
 const [receiveQuantity, setReceiveQuantity] = useState('');
 const [receiveUnitCost, setReceiveUnitCost] = useState('');
 const [receiveNotes, setReceiveNotes] = useState('');

 // New Request State
 const [newItem, setNewItem] = useState({
  itemName: '',
  quantity: '',
  unit: 'KG',
  purpose: ''
 });

 const colDefs = useMemo<ColDef<ProcurementRequestRow>[]>(() => [
  {
   headerName: "Item Name",
   flex: 1.5,
   minWidth: 150,
   filter: true,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.name || 'Unknown'
  },
  {
   headerName: "Quantity",
   flex: 0.8,
   filter: true,
   type: 'numericColumn',
   valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
  },
  {
   headerName: "Unit",
   width: 100,
   filter: true,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.unit || ''
  },
  {
   field: "notes",
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
   field: "createdAt",
   headerName: "Date Requested",
   flex: 1,
   valueFormatter: (p: any) => new Date(p.value).toLocaleDateString(),
   sort: 'desc'
  },
  {
   headerName: "Actions",
   width: 100,
   cellRenderer: (params: any) => {
    if (params.data.status === 'APPROVED') {
     return (
      <div className="flex justify-center h-full items-center">
       <button
        onClick={() => {
         setRequestToReceive(params.data);
         const qty = params.data.lines?.[0]?.quantityRequested ?? 0;
         setReceiveQuantity(String(qty));
         setReceiveUnitCost('');
         setReceiveNotes('');
         setReceiveDialogOpen(true);
        }}
        className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
        title="Mark as Received (Updates Inventory)"
       >
        <CheckCircle className="w-5 h-5" />
       </button>
      </div>
     );
    }
    return null;
   }
  }
 ], []);

 const loadData = async () => {
  setLoading(true);
  const response = await fetch('/api/procurement/requests');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
   console.error('Error loading procurement requests:', payload.error || response.statusText);
  } else {
   setRowData(payload.requests || []);
  }
  setLoading(false);
 };

 const loadInventoryItems = async () => {
  const response = await fetch('/api/inventory/location?code=STORE');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
   console.error('Error loading inventory items:', payload.error || response.statusText);
   return;
  }
  setInventoryItems(payload.items || []);
 };

 const handleCreateRequest = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  const response = await fetch('/api/procurement/requests', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    itemName: newItem.itemName,
    quantity: Number(newItem.quantity),
    unit: newItem.unit,
    purpose: newItem.purpose
   })
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   alert("Failed to create request: " + (payload.error || response.statusText));
  } else {
   setShowNewRequest(false);
   setNewItem({ itemName: '', quantity: '', unit: 'KG', purpose: '' });
   loadData();
  }
  setSubmitting(false);
 };

 const handleReceive = async () => {
  if (!requestToReceive) return;
  if (!receiveUnitCost || Number(receiveUnitCost) < 0) {
   alert('Unit cost is required.');
   return;
  }
  setIsReceiving(true);

  try {
   const response = await fetch(`/api/procurement/requests/${requestToReceive.id}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
     quantityReceived: Number(receiveQuantity || requestToReceive.lines?.[0]?.quantityRequested || 0),
     unitCost: Number(receiveUnitCost),
     notes: receiveNotes
    })
   });

   if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to receive items');
   }

   setReceiveDialogOpen(false);
   setRequestToReceive(null);
   loadData();
   alert("Items received and inventory updated.");

  } catch (error: any) {
   alert("Error: " + error.message);
  } finally {
   setIsReceiving(false);
  }
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
      <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all hover:scale-105 active:scale-95">
       <Plus className="w-4 h-4 mr-2" />
       New Procurement Request
      </Button>
     </DialogTrigger>
     <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
       <DialogTitle>New Procurement Request</DialogTitle>
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
        <Button type="submit" disabled={submitting} className="bg-emerald-600 w-full">
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

   <AlertDialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
    <AlertDialogContent>
     <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center text-blue-600">
       <CheckCircle className="w-5 h-5 mr-2" />
       Confirm Receipt?
      </AlertDialogTitle>
     <AlertDialogDescription>
      This will add <strong>{requestToReceive?.lines?.[0]?.quantityRequested} {requestToReceive?.lines?.[0]?.item?.unit}</strong> of <strong>{requestToReceive?.lines?.[0]?.item?.name}</strong> to your inventory.
      <br /><br />
      Ensure you have physically confirmed the items.
     </AlertDialogDescription>
    </AlertDialogHeader>
     <div className="space-y-4 py-2">
      <div className="space-y-2">
       <Label htmlFor="receiveQty">Received Quantity</Label>
       <Input
        id="receiveQty"
        type="number"
        step="0.01"
        value={receiveQuantity}
        onChange={(e) => setReceiveQuantity(e.target.value)}
        required
       />
      </div>
      <div className="space-y-2">
       <Label htmlFor="receiveCost">Unit Cost</Label>
       <Input
        id="receiveCost"
        type="number"
        step="0.01"
        value={receiveUnitCost}
        onChange={(e) => setReceiveUnitCost(e.target.value)}
        required
       />
      </div>
      <div className="space-y-2">
       <Label htmlFor="receiveNotes">Notes (optional)</Label>
       <Textarea
        id="receiveNotes"
        value={receiveNotes}
        onChange={(e) => setReceiveNotes(e.target.value)}
        placeholder="Supplier, invoice, delivery notes..."
       />
      </div>
     </div>
    <AlertDialogFooter>
     <AlertDialogCancel disabled={isReceiving}>Cancel</AlertDialogCancel>
      <AlertDialogAction
       onClick={(e) => {
        e.preventDefault();
        handleReceive();
       }}
       disabled={isReceiving}
       className="bg-blue-600 hover:bg-blue-700 text-white"
      >
       {isReceiving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Receipt"}
      </AlertDialogAction>
     </AlertDialogFooter>
    </AlertDialogContent>
   </AlertDialog>
  </div>
 );
}
