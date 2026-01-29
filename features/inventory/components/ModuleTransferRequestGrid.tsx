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
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule,
 themeQuartz
} from 'ag-grid-community';
import { ClipboardList, Loader2 } from 'lucide-react';

type ModuleKey = 'FEED_MILL' | 'POULTRY' | 'BSF';

type TransferLine = {
 item?: { name?: string; unit?: string };
 quantityRequested: number;
 quantityTransferred?: number | null;
};

type RequestedByProfile = {
 email: string | null;
 role: string | null;
};

type TransferRequestRow = {
 id: string;
 status: string;
 createdAt: string;
 notes?: string | null;
 requestedBy?: string | null;
 requestedByProfile?: RequestedByProfile | null;
 lines?: TransferLine[];
 to?: { code?: string };
};

// Register modules
ModuleRegistry.registerModules([
 CellStyleModule,
 ClientSideRowModelModule,
 ValidationModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule
]);

export function ModuleTransferRequestGrid({ moduleKey }: { moduleKey: ModuleKey }) {
 const [rowData, setRowData] = useState<TransferRequestRow[]>([]);
 const [loading, setLoading] = useState(true);

 const filteredData = useMemo(() => (
  rowData.filter(request => request.to?.code === moduleKey)
 ), [rowData, moduleKey]);

 const colDefs = useMemo<ColDef<TransferRequestRow>[]>(() => [
  {
   headerName: "Item",
   flex: 1.5,
   minWidth: 180,
   filter: true,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.name || 'Unknown'
  },
  {
   headerName: "Qty",
   width: 110,
   type: 'numericColumn',
   valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
  },
  {
   headerName: "Unit",
   width: 90,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.unit || ''
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
    if (status === 'COMPLETED') colorClass = 'bg-blue-100 text-blue-700';

    return (
     <span className={`px-2 py-1 rounded-full text-xs font-bold ${colorClass}`}>
      {status}
     </span>
    );
   }
  },
  {
   headerName: "Requested By",
   flex: 1.2,
   minWidth: 180,
   valueGetter: (p: any) => {
    const profile = p.data.requestedByProfile;
    if (profile?.role) return profile.role;
    if (profile?.email) return profile.email;
    if (p.data.requestedBy) return `${p.data.requestedBy.slice(0, 8)}...`;
    return '';
   }
  },
  {
   field: "createdAt",
   headerName: "Requested At",
   flex: 1,
   minWidth: 160,
   valueFormatter: (p: any) => {
    const parsed = new Date(p.value);
    const datePart = parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${datePart} ${parsed.toLocaleTimeString()}`;
   }
  },
  {
   field: "notes",
   headerName: "Notes",
   flex: 1.5,
   minWidth: 200
  }
 ], []);

 useEffect(() => {
  const loadRequests = async () => {
   setLoading(true);
   const response = await fetch('/api/transfers');
   const payload = await response.json().catch(() => ({}));
   if (!response.ok) {
    console.error('Error loading transfer requests:', payload.error || response.statusText);
   } else {
    setRowData(payload.requests || []);
   }
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
    {filteredData.length === 0 ? (
     <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <ClipboardList className="w-12 h-12 mb-2 opacity-20" />
      <p>No requests found</p>
     </div>
    ) : (
     <AgGridReact
      rowData={filteredData}
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
