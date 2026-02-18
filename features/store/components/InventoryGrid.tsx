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
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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
 lastPurchaseUnitCost?: number | null;
 lastPurchaseDate?: string | null;
};

export function InventoryGrid() {
 const todayDdMmYyyy = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
 };

 const ddMmYyyyToIso = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
 };

 const isoToDdMmYyyy = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
 };

 const [rowData, setRowData] = useState<StoreItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [editingId, setEditingId] = useState<string | null>(null);

 const [showNewItem, setShowNewItem] = useState(false);
 const [showReceive, setShowReceive] = useState(false);
 const [showEdit, setShowEdit] = useState(false);

 const [newItem, setNewItem] = useState({ name: '', unit: 'KG', description: '', trackInFeedMill: true });
 const [receiveForm, setReceiveForm] = useState({
  ingredientId: '',
  quantity: '',
  unitPrice: '',
  purchaseDate: todayDdMmYyyy(),
  reference: 'DIRECT_STORE_ENTRY',
  notes: ''
 });
 const [editForm, setEditForm] = useState({
  id: '',
  name: '',
  unit: 'KG',
  description: '',
  purchaseDate: '',
  trackInFeedMill: true,
  adjustQuantity: '',
  adjustDirection: 'OUT',
  adjustReason: ''
 });
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

 const openEdit = (item: StoreItem) => {
  setEditForm({
   id: item.id,
   name: item.name ?? '',
   unit: item.unit ?? 'KG',
   description: item.description ?? '',
   purchaseDate: isoToDdMmYyyy(item.lastPurchaseDate),
   trackInFeedMill: item.trackInFeedMill ?? true,
   adjustQuantity: '',
   adjustDirection: 'OUT',
   adjustReason: ''
  });
  setShowEdit(true);
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
   field: "lastPurchaseUnitCost",
   headerName: "Unit Cost (N)",
   flex: 1,
   type: 'numericColumn',
   valueGetter: (params: any) => Number(params.data?.lastPurchaseUnitCost ?? 0),
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
   field: "lastPurchaseDate",
   headerName: "Date Purchased",
   flex: 1,
   valueFormatter: (params: any) => {
    if (!params.value) return 'N/A';
    const parsed = new Date(params.value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
   }
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
   width: 160,
   pinned: 'right',
   sortable: false,
   filter: false,
   cellRenderer: (params: any) => {
    const item = params.data as StoreItem;
    const isDeleting = deletingId === item.id;
    const isEditing = editingId === item.id;
    return (
     <div className="flex items-center justify-center h-full w-full gap-1">
      <Button
       size="sm"
       variant="ghost"
       className="h-8 px-2 text-slate-500 hover:text-blue-600 hover:bg-transparent"
       disabled={isDeleting || isEditing}
       onClick={() => openEdit(item)}
      >
       {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
      </Button>
      <Button
       size="sm"
       variant="ghost"
       className="h-8 px-2 text-slate-500 hover:text-rose-600 hover:bg-transparent"
       disabled={isDeleting || isEditing}
       onClick={() => handleDelete(item)}
      >
       {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>
     </div>
    );
   }
  }
  ], [deletingId, editingId]);

 const loadData = async () => {
  setLoading(true);
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const tryLoad = async (attempt: number): Promise<any> => {
   const response = await fetch('/api/inventory/location?code=STORE');
   const payload = await response.json().catch(() => ({}));
   if (response.ok) return payload;

   const message = payload.error || response.statusText || 'Unknown error';
   const isTransient = String(message).toLowerCase().includes('fetch failed');
   if (isTransient && attempt < 3) {
    await sleep(400 * attempt);
    return tryLoad(attempt + 1);
   }

   throw new Error(message);
  };

  try {
   const payload = await tryLoad(1);
   setRowData(payload.items || []);
  } catch (error: any) {
   const message = error?.message || 'Unable to load inventory';
   console.error('Error loading inventory:', message);
   toast({
    title: "Error",
    description: `Failed to load store inventory: ${message}`,
    variant: "destructive"
   });
  } finally {
   setLoading(false);
  }
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

 const handleEdit = async (e: React.FormEvent) => {
  e.preventDefault();
 if (!editForm.id || !editForm.name || !editForm.unit) {
  toast({ title: "Error", description: "Item name and unit are required.", variant: "destructive" });
  return;
 }
  const isoPurchaseDate = editForm.purchaseDate ? ddMmYyyyToIso(editForm.purchaseDate) : null;
  if (editForm.purchaseDate && !isoPurchaseDate) {
   toast({ title: "Error", description: "Use date format dd-mm-yyyy.", variant: "destructive" });
   return;
  }

  setSubmitting(true);
  setEditingId(editForm.id);

  const updateResponse = await fetch(`/api/inventory/items/${editForm.id}`, {
   method: 'PATCH',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    name: editForm.name,
    unit: editForm.unit,
    description: editForm.description || null,
    lastPurchaseDate: isoPurchaseDate,
    trackInFeedMill: editForm.trackInFeedMill
   })
  });

  if (!updateResponse.ok) {
   const payload = await updateResponse.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to update item.',
    variant: "destructive"
   });
   setSubmitting(false);
   setEditingId(null);
   return;
  }

  const adjustQty = Number(editForm.adjustQuantity || 0);
  if (adjustQty > 0) {
   const adjustResponse = await fetch('/api/inventory/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
     ingredientId: editForm.id,
     quantity: adjustQty,
     direction: editForm.adjustDirection,
     reason: editForm.adjustReason || 'Edited from inventory table',
     locationCode: 'STORE'
    })
   });

   if (!adjustResponse.ok) {
    const payload = await adjustResponse.json().catch(() => ({}));
    toast({
     title: "Error",
     description: payload.error || 'Item updated but stock adjustment failed.',
     variant: "destructive"
    });
    setSubmitting(false);
    setEditingId(null);
    loadData();
    return;
   }
  }

  toast({
   title: "Success",
   description: "Inventory item updated successfully.",
   variant: "success"
  });
  setShowEdit(false);
  setSubmitting(false);
  setEditingId(null);
  loadData();
 };

 const handleReceive = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!receiveForm.ingredientId) {
   toast({ title: "Error", description: "Select an item to receive.", variant: "destructive" });
   return;
  }
  const isoPurchaseDate = ddMmYyyyToIso(receiveForm.purchaseDate);
  if (!isoPurchaseDate) {
   toast({ title: "Error", description: "Use date format dd-mm-yyyy.", variant: "destructive" });
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
    purchaseDate: isoPurchaseDate,
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
    purchaseDate: todayDdMmYyyy(),
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
        <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label htmlFor="receivePurchaseDate">Date Purchased</Label>
          <Input
           id="receivePurchaseDate"
           type="text"
           value={receiveForm.purchaseDate}
           onChange={(e) => setReceiveForm({ ...receiveForm, purchaseDate: e.target.value })}
           placeholder="dd-mm-yyyy"
           pattern="\d{2}-\d{2}-\d{4}"
           required
          />
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

     <Dialog open={showEdit} onOpenChange={setShowEdit}>
      <DialogContent>
       <DialogHeader>
        <DialogTitle>Edit Inventory Item</DialogTitle>
       </DialogHeader>
       <form onSubmit={handleEdit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
         <div className="space-y-2">
          <Label htmlFor="editItemName">Item Name</Label>
          <Input
           id="editItemName"
           value={editForm.name}
           onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
           required
          />
         </div>
         <div className="space-y-2">
          <Label htmlFor="editItemUnit">Unit</Label>
          <Select
           value={editForm.unit}
           onValueChange={(value) => setEditForm({ ...editForm, unit: value })}
          >
           <SelectTrigger id="editItemUnit">
            <SelectValue placeholder="Select unit" />
           </SelectTrigger>
           <SelectContent>
            {unitOptions.map((unit) => (
             <SelectItem key={unit} value={unit}>{unit}</SelectItem>
            ))}
           </SelectContent>
          </Select>
         </div>
        </div>
        <div className="space-y-2">
         <Label htmlFor="editPurchaseDate">Date Purchased</Label>
         <Input
          id="editPurchaseDate"
          type="text"
          value={editForm.purchaseDate}
          onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
          placeholder="dd-mm-yyyy"
          pattern="\d{2}-\d{2}-\d{4}"
         />
        </div>
        <div className="border-t pt-3 space-y-3">
         <p className="text-sm font-medium">Optional stock adjustment</p>
         <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
           <Label htmlFor="editAdjustQty">Quantity</Label>
           <Input
            id="editAdjustQty"
            type="number"
            step="0.01"
            min="0"
            value={editForm.adjustQuantity}
            onChange={(e) => setEditForm({ ...editForm, adjustQuantity: e.target.value })}
            placeholder="Leave 0 to skip"
           />
          </div>
          <div className="space-y-2">
           <Label>Direction</Label>
           <Select
            value={editForm.adjustDirection}
            onValueChange={(value) => setEditForm({ ...editForm, adjustDirection: value })}
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
          <Label htmlFor="editAdjustReason">Reason</Label>
          <Textarea
           id="editAdjustReason"
           value={editForm.adjustReason}
           onChange={(e) => setEditForm({ ...editForm, adjustReason: e.target.value })}
           placeholder="Reason for this stock change"
         />
         </div>
        </div>
        <div className="flex items-center gap-2">
         <input
          id="editTrackInFeedMill"
          type="checkbox"
          checked={editForm.trackInFeedMill}
          onChange={(e) => setEditForm({ ...editForm, trackInFeedMill: e.target.checked })}
         />
         <Label htmlFor="editTrackInFeedMill">Show in Feed Mill inventory</Label>
        </div>
        <DialogFooter>
         <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Changes
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


