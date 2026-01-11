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
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreRequest } from '@/types';
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

export function StoreRequestGrid() {
 const [rowData, setRowData] = useState<StoreRequest[]>([]);
 const [loading, setLoading] = useState(true);
 const [showNewRequest, setShowNewRequest] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // New Request State
 const [newItem, setNewItem] = useState({
  itemName: '',
  quantity: '',
  unit: 'KG',
  purpose: ''
 });

 const colDefs = useMemo<ColDef<StoreRequest>[]>(() => [
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
   filter: true,
   type: 'numericColumn'
  },
  {
   field: "unit",
   headerName: "Unit",
   width: 100,
   filter: true
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
   field: "createdAt",
   headerName: "Date Requested",
   flex: 1,
   valueFormatter: (p: any) => new Date(p.value).toLocaleDateString(),
   sort: 'desc'
  }
 ], []);

 const loadData = async () => {
  setLoading(true);
  const supabase = createClient();
  const { data, error } = await supabase
   .from('StoreRequest')
   .select('*')
   .order('createdAt', { ascending: false });

  if (data) setRowData(data as any);
  setLoading(false);
 };

 const handleCreateRequest = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  const supabase = createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
   alert("You must be logged in.");
   setSubmitting(false);
   return;
  }

  const { error } = await supabase
   .from('StoreRequest')
   .insert({
    itemId: 'MANUAL', // Placeholder for now if no item catalog
    itemName: newItem.itemName,
    quantity: Number(newItem.quantity),
    unit: newItem.unit,
    purpose: newItem.purpose,
    requestedBy: user.id,
    status: 'PENDING'
   });

  if (error) {
   alert("Failed to create request: " + error.message);
  } else {
   setShowNewRequest(false);
   setNewItem({ itemName: '', quantity: '', unit: 'KG', purpose: '' });
   loadData();
  }
  setSubmitting(false);
 };

 useEffect(() => {
  loadData();
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
       New Store Request
      </Button>
     </DialogTrigger>
     <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
       <DialogTitle>New Store Request</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleCreateRequest} className="space-y-4 py-4">
       <div className="space-y-2">
        <Label htmlFor="item">Item Name</Label>
        <Input
         id="item"
         placeholder="e.g. Empty Sacks, Generator Fuel"
         value={newItem.itemName}
         onChange={e => setNewItem({ ...newItem, itemName: e.target.value })}
         required
        />
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
         <Label htmlFor="unit">Unit</Label>
         <Input
          id="unit"
          placeholder="KG, PCS, LITERS"
          value={newItem.unit}
          onChange={e => setNewItem({ ...newItem, unit: e.target.value.toUpperCase() })}
          required
         />
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
  </div>
 );
}
