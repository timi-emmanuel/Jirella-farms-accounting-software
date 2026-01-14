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
import { Loader2, Plus, SlidersHorizontal } from 'lucide-react';
import { Ingredient } from '@/types';
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

 const [showNewItem, setShowNewItem] = useState(false);
 const [showAdjust, setShowAdjust] = useState(false);

 const [newItem, setNewItem] = useState({ name: '', unit: 'KG', description: '', trackInFeedMill: true });
 const [adjustForm, setAdjustForm] = useState({ ingredientId: '', quantity: '', direction: 'OUT', reason: '' });
 const unitOptions = ['KG', 'TON', 'LITER', 'BAG', 'CRATE'];

 const colDefs = useMemo<ColDef<StoreItem>[]>(() => [
  {
   field: "name",
   headerName: "Item Name",
   flex: 1.5,
   minWidth: 150,
   filter: true,
   checkboxSelection: true
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
   headerName: "Avg. Cost",
   flex: 1,
   type: 'numericColumn',
   valueFormatter: (params: any) => `₦${Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  },
  {
   field: "updatedAt",
   headerName: "Last Updated",
   flex: 1,
   valueFormatter: (params: any) => new Date(params.value).toLocaleDateString(),
   sort: 'desc'
  }
 ], []);

 const loadData = async () => {
  setLoading(true);
  const response = await fetch('/api/inventory/location?code=STORE');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
   console.error('Error loading inventory:', payload.error || response.statusText);
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
   alert(payload.error || 'Failed to create item.');
  } else {
   setShowNewItem(false);
   setNewItem({ name: '', unit: 'KG', description: '', trackInFeedMill: true });
   loadData();
  }
  setSubmitting(false);
 };

 const handleAdjust = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!adjustForm.ingredientId) {
   alert('Select an item to adjust.');
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
   alert(payload.error || 'Failed to adjust stock.');
  } else {
   setShowAdjust(false);
   setAdjustForm({ ingredientId: '', quantity: '', direction: 'OUT', reason: '' });
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
