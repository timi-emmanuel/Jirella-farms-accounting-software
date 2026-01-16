"use client";

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ColDef,
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

type TransferLine = {
  product?: { name?: string; unit?: string; unitSizeKg?: number | null };
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

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  PaginationModule,
  RowStyleModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule
]);

export function FinishedFeedRequestGrid() {
  const [rowData, setRowData] = useState<TransferRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const filteredData = useMemo(() => (
    rowData.filter(request => request.to?.code === 'POULTRY')
  ), [rowData]);

  const colDefs = useMemo<ColDef<TransferRequestRow>[]>(() => [
    {
      headerName: "Feed",
      flex: 1.6,
      minWidth: 180,
      filter: true,
      valueGetter: (p: any) => p.data.lines?.[0]?.product?.name || 'Unknown'
    },
    {
      headerName: "Qty (Unit)",
      width: 120,
      type: 'numericColumn',
      valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
    },
    {
      headerName: "Qty (kg)",
      width: 120,
      type: 'numericColumn',
      valueGetter: (p: any) => {
        const line = p.data.lines?.[0];
        const unit = line?.product?.unit;
        const unitSize = Number(line?.product?.unitSizeKg || 0);
        const qty = Number(line?.quantityRequested || 0);
        if (unit === 'BAG' && unitSize > 0) return qty * unitSize;
        return qty;
      }
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
      flex: 1,
      minWidth: 170,
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
      valueFormatter: (p: any) => new Date(p.value).toLocaleString()
    },
    {
      field: "notes",
      headerName: "Notes",
      flex: 1.4,
      minWidth: 200
    }
  ], []);

  useEffect(() => {
    const loadRequests = async () => {
      setLoading(true);
      const response = await fetch('/api/finished-goods/transfers');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Error loading finished feed requests:', payload.error || response.statusText);
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
