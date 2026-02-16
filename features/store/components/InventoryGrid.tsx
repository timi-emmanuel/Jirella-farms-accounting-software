"use client"

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
import { Loader2, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Ingredient } from '@/types';
import { toast } from "@/lib/toast";
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
 CellStyleModule,
 ClientSideRowModelModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule
]);

type StoreItem = Ingredient & {
 quantityOnHand: number;
 averageUnitCost: number;
};

export function InventoryGrid() {
 const [rowData, setRowData] = useState<StoreItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [deletingId, setDeletingId] = useState<string | null>(null);

 const [showNewItem, setShowNewItem] = useState(false);
 const [showReceive, setShowReceive] = useState(false);
 const [showAdjust, setShowAdjust] = useState(false);

 const [newItem, setNewItem] = useState({ name: '', unit: 'KG', description: '', trackInFeedMill: true });
 const [receiveForm, setReceiveForm] = useState({
  ingredientId: '',
  quantity: '',
  unitPrice: '',
  reference: 'DIRECT_STORE_ENTRY',
  notes: ''
 });
 const [adjustForm, setAdjustForm] = useState({ ingredientId: '', quantity: '', direction: 'OUT', reason: '' });
 const unitOptions = ['KG', 'TON', 'LITER', 'BAG', 'CRATE', 'PCS'];

 const handleDelete = async (item: StoreItem) => {
  if (!confirm(`Delete ${item.name}? This cannot be undone.`)) return;
  setDeletingId(item.id);
  const response = await fetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
 if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  toast({
   title: "Error",
   description: payload.error || 'Failed to delete item.',
   variant: "destructive"
  });
 } else {
   toast({
    title: "Success",
    description: `${item.name} deleted successfully.`,
    variant: "success"
   });
   loadData();
  }
  setDeletingId(null);
 };

 const colDefs = useMemo<ColDef<StoreItem>[]>(() => [
  {
   field: "name",
   headerName: "Item Name",
   flex: 1.5,
   minWidth: 150,
   filter: true
  },
  {
   field: "unit",
   headerName: "Unit",
   width: 100,
   filter: true,
   cellRenderer: (params: any) => (
    <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
     {params.value}
    </span>
   )
  },
  {
   field: "quantityOnHand",
   headerName: "Current Stock",
   flex: 1,
   type: 'numericColumn',
   valueFormatter: (params: any) => Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
   cellStyle: (params: any) => {
    if (params.value <= 100) return { color: '#ef4444', fontWeight: 'bold' };
    return { color: 'inherit', fontWeight: 'bold' };
   }
  },
  {
   field: "averageUnitCost",
   headerName: "Avg. Unit Cost (₦)",
   flex: 1,
   type: 'numericColumn',
   valueFormatter: (params: any) => Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   headerName: "Total Cost (₦)",
   flex: 1,
   type: 'numericColumn',
   valueGetter: (params: any) => {
    const qty = Number(params.data?.quantityOnHand ?? 0);
    const avg = Number(params.data?.averageUnitCost ?? 0);
    return qty * avg;
   },
   valueFormatter: (params: any) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   field: "updatedAt",
   headerName: "Last Updated",
   flex: 1,
   valueFormatter: (params: any) => {
    if (!params.value) return 'N/A';
    const parsed = new Date(params.value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
   },
   sort: 'desc'
  },
  {
   headerName: "Actions",
   width: 120,
   pinned: 'right',
   sortable: false,
   filter: false,
   cellRenderer: (params: any) => {
    const item = params.data as StoreItem;
    const isDeleting = deletingId === item.id;
    return (
     <Button
      size="sm"
      variant="ghost"
      className="h-8 px-2 text-slate-500 hover:text-rose-600 hover:bg-transparent"
      disabled={isDeleting}
      onClick={() => handleDelete(item)}
     >
      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
     </Button>
    );
   }
  }
  ], [deletingId]);

 const loadData = async () => {
  setLoading(true);
  const response = await fetch('/api/inventory/location?code=STORE');
  const payload = await response.json().catch(() => ({}));
 if (!response.ok) {
   const message = payload.error || response.statusText;
   console.error('Error loading inventory:', message);
   toast({
    title: "Error",
    description: `Failed to load store inventory: ${message}`,
    variant: "destructive"
   });
  } else {
   setRowData(payload.items || []);
  }
  setLoading(false);
 };

 useEffect(() => {
  loadData();
 }, []);

 const handleCreateItem = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  const response = await fetch('/api/inventory/items', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify(newItem)
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to create item.',
    variant: "destructive"
   });
  } else {
   setShowNewItem(false);
   setNewItem({ name: '', unit: 'KG', description: '', trackInFeedMill: true });
   toast({
    title: "Success",
    description: "Inventory item created successfully.",
    variant: "success"
   });
   loadData();
  }
  setSubmitting(false);
 };

 const handleAdjust = async (e: React.FormEvent) => {
  e.preventDefault();
 if (!adjustForm.ingredientId) {
  toast({ title: "Error", description: "Select an item to adjust.", variant: "destructive" });
  return;
 }
  setSubmitting(true);
  const response = await fetch('/api/inventory/adjust', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    ingredientId: adjustForm.ingredientId,
    quantity: Number(adjustForm.quantity),
    direction: adjustForm.direction,
    reason: adjustForm.reason,
    locationCode: 'STORE'
   })
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to adjust stock.',
    variant: "destructive"
   });
  } else {
   setShowAdjust(false);
   setAdjustForm({ ingredientId: '', quantity: '', direction: 'OUT', reason: '' });
   toast({
    title: "Success",
    description: "Stock adjustment recorded successfully.",
    variant: "success"
   });
   loadData();
  }
  setSubmitting(false);
 };

 const handleReceive = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!receiveForm.ingredientId) {
   toast({ title: "Error", description: "Select an item to receive.", variant: "destructive" });
   return;
  }
  setSubmitting(true);
  const response = await fetch('/api/inventory/receive', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    ingredientId: receiveForm.ingredientId,
    quantity: Number(receiveForm.quantity),
    unitPrice: Number(receiveForm.unitPrice),
    reference: receiveForm.reference || null,
    notes: receiveForm.notes || null
   })
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to receive stock.',
    variant: "destructive"
   });
  } else {
   setShowReceive(false);
   setReceiveForm({
    ingredientId: '',
    quantity: '',
    unitPrice: '',
    reference: 'DIRECT_STORE_ENTRY',
    notes: ''
   });
   toast({
    title: "Success",
    description: "Stock received successfully.",
    variant: "success"
   });
   loadData();
  }
  setSubmitting(false);
 };

 if (loading && rowData.length === 0) return (
  <div className="flex items-center justify-center h-64">
   <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
  </div>
 );

 return (
  <div className="flex flex-col h-full space-y-4">
   <div className="flex justify-between items-center mb-2">
    <div>
     {/* Optional: Add search or summary stats here later */}
    </div>
    <div className="flex flex-wrap gap-2">
     <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
      <DialogTrigger asChild>
       <Button className="bg-slate-900 hover:bg-slate-800">
        <Plus className="w-4 h-4 mr-2" />
        New Item
       </Button>
      </DialogTrigger>
      <DialogContent>
       <DialogHeader>
        <DialogTitle>Create Inventory Item</DialogTitle>
       </DialogHeader>
       <form onSubmit={handleCreateItem} className="space-y-4">
        <div className="space-y-2">
         <Label htmlFor="itemName">Item Name</Label>
         <Input
          id="itemName"
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          required
         />
        </div>
        <div className="space-y-2">
         <Label htmlFor="itemUnit">Unit</Label>
         <Select
          value={newItem.unit}
          onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
         >
          <SelectTrigger id="itemUnit">
           <SelectValue placeholder="Select unit" />
          </SelectTrigger>
          <SelectContent>
           {unitOptions.map((unit) => (
            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
           ))}
          </SelectContent>
         </Select>
        </div>
        <div className="space-y-2">
         <Label htmlFor="itemDesc">Description</Label>
         <Textarea
          id="itemDesc"
          value={newItem.description}
          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
         />
        </div>
        <div className="flex items-center gap-2">
         <input
          id="trackInFeedMill"
          type="checkbox"
          checked={newItem.trackInFeedMill}
          onChange={(e) => setNewItem({ ...newItem, trackInFeedMill: e.target.checked })}
         />
         <Label htmlFor="trackInFeedMill">Show in Feed Mill inventory</Label>
        </div>
        <DialogFooter>
         <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Item
         </Button>
        </DialogFooter>
       </form>
      </DialogContent>
     </Dialog>

     <Dialog open={showReceive} onOpenChange={setShowReceive}>
      <DialogTrigger asChild>
       <Button className="bg-emerald-700 hover:bg-emerald-800">
        <Plus className="w-4 h-4 mr-2" />
        Stock In
       </Button>
      </DialogTrigger>
      <DialogContent>
       <DialogHeader>
        <DialogTitle>Receive Stock (Direct Store Entry)</DialogTitle>
       </DialogHeader>
       <form onSubmit={handleReceive} className="space-y-4">
        <div className="space-y-2">
         <Label>Item</Label>
         <Select
          value={receiveForm.ingredientId}
          onValueChange={(value) => setReceiveForm({ ...receiveForm, ingredientId: value })}
         >
          <SelectTrigger>
           <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
           {rowData.map(item => (
            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
           ))}
          </SelectContent>
         </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label htmlFor="receiveQty">Quantity</Label>
          <Input
           id="receiveQty"
           type="number"
           step="0.01"
           min="0.01"
           value={receiveForm.quantity}
           onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
           required
          />
         </div>
         <div className="space-y-2">
          <Label htmlFor="receiveUnitPrice">Unit Cost</Label>
          <Input
           id="receiveUnitPrice"
           type="number"
           step="0.01"
           min="0"
           value={receiveForm.unitPrice}
           onChange={(e) => setReceiveForm({ ...receiveForm, unitPrice: e.target.value })}
           required
          />
         </div>
        </div>
        <div className="space-y-2">
         <Label htmlFor="receiveReference">Reference</Label>
         <Input
          id="receiveReference"
          value={receiveForm.reference}
          onChange={(e) => setReceiveForm({ ...receiveForm, reference: e.target.value })}
          placeholder="Invoice / source reference"
         />
        </div>
        <div className="space-y-2">
         <Label htmlFor="receiveNotes">Notes</Label>
         <Textarea
          id="receiveNotes"
          value={receiveForm.notes}
          onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
          placeholder="Optional notes"
         />
        </div>
        <DialogFooter>
         <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Confirm Stock In
         </Button>
        </DialogFooter>
       </form>
      </DialogContent>
     </Dialog>

     <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
      <DialogTrigger asChild>
       <Button className="bg-slate-600 hover:bg-slate-700">
        <SlidersHorizontal className="w-4 h-4 mr-2" />
        Adjust
       </Button>
      </DialogTrigger>
      <DialogContent>
       <DialogHeader>
        <DialogTitle>Adjust Stock</DialogTitle>
       </DialogHeader>
       <form onSubmit={handleAdjust} className="space-y-4">
        <div className="space-y-2">
         <Label>Item</Label>
         <Select
          value={adjustForm.ingredientId}
          onValueChange={(value) => setAdjustForm({ ...adjustForm, ingredientId: value })}
         >
          <SelectTrigger>
           <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
           {rowData.map(item => (
            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
           ))}
          </SelectContent>
         </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label htmlFor="adjustQty">Quantity</Label>
          <Input
           id="adjustQty"
           type="number"
           step="0.01"
           value={adjustForm.quantity}
           onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
           required
          />
         </div>
         <div className="space-y-2">
          <Label>Direction</Label>
          <Select
           value={adjustForm.direction}
           onValueChange={(value) => setAdjustForm({ ...adjustForm, direction: value })}
          >
           <SelectTrigger>
            <SelectValue />
           </SelectTrigger>
           <SelectContent>
            <SelectItem value="IN">Increase</SelectItem>
            <SelectItem value="OUT">Decrease</SelectItem>
           </SelectContent>
          </Select>
         </div>
        </div>
        <div className="space-y-2">
         <Label htmlFor="adjustReason">Reason</Label>
         <Textarea
          id="adjustReason"
          value={adjustForm.reason}
          onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
          placeholder="Spillage, recount, correction..."
          required
         />
        </div>
        <DialogFooter>
         <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Confirm Adjustment
         </Button>
        </DialogFooter>
       </form>
      </DialogContent>
     </Dialog>
    </div>
   </div>

   <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm ag-theme-quartz">
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
   </div>
  </div>
 );
}


