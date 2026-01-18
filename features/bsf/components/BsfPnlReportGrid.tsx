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
import { Loader2 } from 'lucide-react';

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

type PnlRow = {
  month: string;
  revenue: number;
  feedCost: number;
  energyCost: number;
  totalCogs: number;
  grossProfit: number;
};

export function BsfPnlReportGrid() {
  const [rowData, setRowData] = useState<PnlRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/bsf/reports/pnl');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('BSF P&L load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.rows || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<PnlRow>[]>(() => [
    { field: 'month', headerName: 'Month', minWidth: 120 },
    {
      field: 'revenue',
      headerName: 'Revenue',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'feedCost',
      headerName: 'Feed Cost',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'energyCost',
      headerName: 'Energy',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'totalCogs',
      headerName: 'Total COGS',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'grossProfit',
      headerName: 'Gross Profit',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
        pagination={true}
        paginationPageSize={20}
      />
    </div>
  );
}
