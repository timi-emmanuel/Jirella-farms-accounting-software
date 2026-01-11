"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
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
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { StoreRequest } from '@/types';
import { Button } from '@/components/ui/button';

// Register modules
ModuleRegistry.registerModules([
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

export function ProcurementGrid() {
 const [rowData, setRowData] = useState<StoreRequest[]>([]);
 const [loading, setLoading] = useState(true);
 const [processingId, setProcessingId] = useState<string | null>(null);

 const handleAction = async (request: StoreRequest, action: 'APPROVED' | 'REJECTED') => {
  setProcessingId(request.id);
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
   .from('StoreRequest')
   .update({
    status: action,
    approvedBy: user?.id,
    updatedAt: new Date().toISOString()
   })
   .eq('id', request.id);

  if (error) {
   alert(`Failed to ${action.toLowerCase()} request: ` + error.message);
  } else {
   // Remove from list if we only show PENDING, or update status if we show all
   // For procurement worklist, usually pending is mostly relevant, but let's just update local state
   setRowData(prev => prev.map(r => r.id === request.id ? { ...r, status: action } : r));
  }
  setProcessingId(null);
 };

 const colDefs = useMemo<ColDef<StoreRequest>[]>(() => [
  {
   field: "itemName",
   headerName: "Item Requested",
   flex: 1.5,
   minWidth: 150,
   filter: true
  },
  {
   field: "quantity",
   headerName: "Qty",
   width: 100,
   type: 'numericColumn'
  },
  {
   field: "unit",
   headerName: "Unit",
   width: 80,
  },
  {
   field: "purpose",
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
    const request = params.data as StoreRequest;
    if (request.status !== 'PENDING') return null;

    const isProcessing = processingId === request.id;

    return (
     <div className="flex items-center gap-2 h-full">
      <Button
       size="sm"
       className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2"
       onClick={() => handleAction(request, 'APPROVED')}
       disabled={isProcessing}
      >
       {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
       Approve
      </Button>
      <Button
       size="sm"
       variant="destructive"
       className="h-8 px-2"
       onClick={() => handleAction(request, 'REJECTED')}
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
  const loadRequests = async () => {
   setLoading(true);
   const supabase = createClient();
   const { data, error } = await supabase
    .from('StoreRequest')
    .select('*')
    // .eq('status', 'PENDING') // Optionally filter only pending
    .order('createdAt', { ascending: false });

   if (data) setRowData(data as any);
   setLoading(false);
  };
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
