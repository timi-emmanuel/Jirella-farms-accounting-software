"use client"

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 CellStyleModule,
 ModuleRegistry,
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
import { Loader2, PackagePlus } from 'lucide-react';
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
import { toast } from "@/lib/toast";

type ModuleKey = 'FEED_MILL' | 'POULTRY' | 'BSF';

type RequestForm = {
 ingredientId: string;
 quantity: string;
 requestDate: string;
 notes: string;
};

const formatDateDMY = (date: Date) => {
 const day = String(date.getDate()).padStart(2, '0');
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const year = date.getFullYear();
 return `${day}-${month}-${year}`;
};

const dmyToIso = (value: string) => {
 const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec((value || '').trim());
 if (!match) return null;
 const [, dd, mm, yyyy] = match;
 const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
 if (Number.isNaN(date.getTime())) return null;
 return `${yyyy}-${mm}-${dd}`;
};

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

type ModuleItem = Ingredient & {
 quantityOnHand: number;
 averageUnitCost: number;
};

export function ModuleInventoryGrid({ moduleKey }: { moduleKey: ModuleKey }) {
 const [rowData, setRowData] = useState<ModuleItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [requesting, setRequesting] = useState(false);
 const [dialogOpen, setDialogOpen] = useState(false);
 const [requestForm, setRequestForm] = useState<RequestForm>({
  ingredientId: '',
  quantity: '',
  requestDate: formatDateDMY(new Date()),
  notes: ''
 });

 const colDefs = useMemo<ColDef<ModuleItem>[]>(() => [
  {
   field: "name",
   headerName: "Item Name",
   flex: 1.5,
   minWidth: 160,
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
   headerName: "Available",
   flex: 1,
   type: 'numericColumn',
   valueFormatter: (params: any) => Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   field: "averageUnitCost",
   headerName: "Avg. Cost (₦)",
   flex: 1,
   type: 'numericColumn',
   valueFormatter: (params: any) => Number(params.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   headerName: "Actions",
   width: 140,
   cellRenderer: (params: any) => (
    <Button
     size="sm"
     variant="outline"
     className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
     onClick={() => {
      setRequestForm({
       ingredientId: params.data.id,
       quantity: '',
       requestDate: formatDateDMY(new Date()),
       notes: ''
      });
      setDialogOpen(true);
     }}
    >
     <PackagePlus className="w-4 h-4 mr-2" />
     Request
    </Button>
   )
  }
 ], []);

 const loadData = async () => {
  setLoading(true);
  const response = await fetch(`/api/inventory/location?code=${moduleKey}`);
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

 const handleRequest = async (e: React.FormEvent) => {
  e.preventDefault();
 if (!requestForm.ingredientId || !requestForm.quantity || Number(requestForm.quantity) <= 0) {
  toast({ title: "Error", description: "Enter a valid quantity.", variant: "destructive" });
  return;
 }
 const isoRequestDate = dmyToIso(requestForm.requestDate);
 if (!isoRequestDate) {
  toast({ title: "Error", description: "Date requested must be in DD-MM-YYYY format.", variant: "destructive" });
  return;
 }

  setRequesting(true);
  const response = await fetch('/api/transfers', {
   method: 'POST',
   credentials: 'include',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    itemId: requestForm.ingredientId,
    quantity: Number(requestForm.quantity),
    requestDate: isoRequestDate,
    notes: requestForm.notes,
    toLocationCode: moduleKey
   })
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to submit request.',
    variant: "destructive"
   });
  } else {
   setDialogOpen(false);
   setRequestForm({ ingredientId: '', quantity: '', requestDate: formatDateDMY(new Date()), notes: '' });
   toast({ title: "Success", description: "Request made successfully.", variant: "success" });
  }
  setRequesting(false);
 };

 if (loading && rowData.length === 0) {
  return (
   <div className="flex items-center justify-center h-full">
    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
   </div>
  );
 }

 return (
  <div className="flex flex-col h-full space-y-4">
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

   <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
    <DialogTrigger asChild>
     <span />
    </DialogTrigger>
    <DialogContent>
     <DialogHeader>
      <DialogTitle>Request from Store</DialogTitle>
     </DialogHeader>
     <form onSubmit={handleRequest} className="space-y-4">
      <div className="space-y-2">
       <Label htmlFor="requestQty">Quantity</Label>
       <Input
        id="requestQty"
        type="number"
        step="0.01"
        value={requestForm.quantity}
        onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })}
        required
       />
      </div>
      <div className="space-y-2">
       <Label htmlFor="requestDate">Date Requested</Label>
       <Input
        id="requestDate"
        type="text"
        placeholder="DD-MM-YYYY"
        value={requestForm.requestDate}
        onChange={(e) => setRequestForm({ ...requestForm, requestDate: e.target.value })}
        required
       />
      </div>
      <div className="space-y-2">
       <Label htmlFor="requestNotes">Notes (optional)</Label>
       <Textarea
        id="requestNotes"
        value={requestForm.notes}
        onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
        placeholder="Usage reason or urgency"
       />
      </div>
      <DialogFooter>
       <Button type="submit" disabled={requesting}>
        {requesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Submit Request
       </Button>
      </DialogFooter>
     </form>
    </DialogContent>
   </Dialog>
  </div>
 );
}


