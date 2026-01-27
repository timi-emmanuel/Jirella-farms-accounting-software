"use client";

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
import { Loader2 } from 'lucide-react';

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

type BatchRow = {
  batchId: string;
  batchCode: string;
  status: string;
  startDate: string;
  revenue: number;
  feedCost: number;
  fingerlingCost: number;
  totalCogs: number;
  profit: number;
};

export function CatfishBatchPnlGrid() {
  const [rowData, setRowData] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/catfish/reports/batch-pnl');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Catfish batch P&L load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.rows || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<BatchRow>[]>(() => [
    { field: 'batchCode', headerName: 'Batch', minWidth: 140 },
    { field: 'status', headerName: 'Status', minWidth: 120 },
    { field: 'startDate', headerName: 'Start Date', minWidth: 120 },
    {
      field: 'revenue',
      headerName: 'Revenue (₦)',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => `₦ ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'feedCost',
      headerName: 'Feed Cost (₦)',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => `₦ ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'fingerlingCost',
      headerName: 'Fishes Cost (₦)',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => `₦ ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'totalCogs',
      headerName: 'Total COGS (₦)',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => `₦ ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'profit',
      headerName: 'Profit (₦)',
      type: 'numericColumn',
      minWidth: 120,
      valueFormatter: (p: any) => `₦ ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    }
  ], []);

  if (loading && rowData.length === 0) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 border rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/50">
        <AgGridReact
          theme={themeQuartz}
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            wrapHeaderText: true,
            autoHeaderHeight: true,
          }}
          overlayNoRowsTemplate="<span class='text-slate-500'>No records found</span>"
          pagination={true}
          paginationPageSize={20}
        />
      </div>
    </div>
  );
}
