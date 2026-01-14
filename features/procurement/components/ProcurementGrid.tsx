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
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export function ProcurementGrid() {
 const [rowData, setRowData] = useState<ProcurementRequestRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [processingId, setProcessingId] = useState<string | null>(null);

 const loadRequests = async () => {
  setLoading(true);
  const response = await fetch('/api/procurement/requests');
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
   setRowData(payload.requests || []);
  } else {
   console.error('Failed to load procurement requests:', payload.error || response.statusText);
  }
  setLoading(false);
 };

 const handleAction = async (request: ProcurementRequestRow, action: 'APPROVED' | 'REJECTED') => {
  setProcessingId(request.id);
  const endpoint = action === 'APPROVED'
   ? `/api/procurement/requests/${request.id}/approve`
   : `/api/procurement/requests/${request.id}/reject`;

  const response = await fetch(endpoint, { method: 'POST' });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   alert(`Failed to ${action.toLowerCase()} request: ` + (payload.error || response.statusText));
  } else {
   await loadRequests();
  }
  setProcessingId(null);
 };

 const colDefs = useMemo<ColDef<ProcurementRequestRow>[]>(() => [
  {
   headerName: "Item Requested",
   flex: 1.5,
   minWidth: 150,
   filter: true,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.name || 'Unknown'
  },
  {
   headerName: "Qty",
   width: 100,
   type: 'numericColumn',
   valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
  },
  {
   headerName: "Unit",
   width: 80,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.unit || ''
  },
  {
   field: "notes",
   headerName: "Purpose",
   flex: 2,
   minWidth: 200,
  },
  {
   field: "status",
   headerName: "Status",
   width: 110,
   cellRenderer: (params: any) => {
    const status = params.value;
    let colorClass = 'bg-slate-100 text-slate-600';
    if (status === 'PENDING') colorClass = 'bg-amber-100 text-amber-700';
    if (status === 'APPROVED') colorClass = 'bg-emerald-100 text-emerald-700';
    if (status === 'REJECTED') colorClass = 'bg-rose-100 text-rose-700';

    return (
     <span className={`px-2 py-1 rounded-full text-xs font-bold ${colorClass}`}>
      {status}
     </span>
    );
   }
  },
  {
   headerName: "Actions",
   width: 200,
   pinned: 'right',
   sortable: false,
   filter: false,
   cellRenderer: (params: any) => {
    const request = params.data as ProcurementRequestRow;
    if (request.status !== 'PENDING') return null;

    const isProcessing = processingId === request.id;

    return (
     <div className="flex items-center gap-2 h-full">
      <AlertDialog>
       <AlertDialogTrigger asChild>
        <Button
         size="sm"
         className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2"
         disabled={isProcessing}
        >
         {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
         Approve
        </Button>
       </AlertDialogTrigger>
       <AlertDialogContent>
        <AlertDialogHeader>
         <AlertDialogTitle>Approve Request</AlertDialogTitle>
         <AlertDialogDescription>
          Are you sure you want to approve this request for <strong>{request.lines?.[0]?.quantityRequested} {request.lines?.[0]?.item?.unit} of {request.lines?.[0]?.item?.name}</strong>?
          <br /><br />
          <span className="text-amber-600 font-bold">Note: This will NOT update inventory stock yet.</span>
          <br />
          Stock will be updated only when the Store Keeper marks items as "Received".
         </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
         <AlertDialogCancel>Cancel</AlertDialogCancel>
         <AlertDialogAction
          className="bg-emerald-600"
          onClick={() => handleAction(request, 'APPROVED')}
         >
          Confirm Approval
         </AlertDialogAction>
        </AlertDialogFooter>
       </AlertDialogContent>
      </AlertDialog>

      <Button
       size="sm"
       variant="destructive"
       className="h-8 px-2"
       onClick={() => {
        if (confirm("Reject this request?")) {
         handleAction(request, 'REJECTED');
        }
       }}
       disabled={isProcessing}
      >
       <XCircle className="w-4 h-4 mr-1" />
       Reject
      </Button>
     </div>
    );
   }
  }
 ], [processingId]);

 useEffect(() => {
  loadRequests();
 }, []);

 if (loading) return (
  <div className="flex items-center justify-center h-full">
   <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
  </div>
 );

 return (
  <div className="flex flex-col h-full space-y-4">
   <div className="flex-1 bg-white border rounded-lg overflow-hidden shadow-sm ag-theme-quartz">
    {rowData.length === 0 ? (
     <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <CheckCircle2 className="w-12 h-12 mb-2 opacity-20" />
      <p>No procurement requests found</p>
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
