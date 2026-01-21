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

type PurchaseRow = {
  id: string;
  purchaseDate: string;
  quantityKg: number;
  unitPrice: number;
  totalAmount: number;
  product?: { name?: string; unit?: string };
};

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

export function PoultryFeedPurchaseGrid() {
  const [rowData, setRowData] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/internal-sales');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Feed purchases load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.purchases || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<PurchaseRow>[]>(() => [
    {
      field: "purchaseDate",
      headerName: "Date",
      minWidth: 140
    },
    {
      headerName: "Feed",
      flex: 1.6,
      minWidth: 180,
      valueGetter: (p: any) => p.data.product?.name || 'Unknown'
    },
    {
      field: "quantityKg",
      headerName: "Qty (kg)",
      type: 'numericColumn',
      minWidth: 120,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: "unitPrice",
      headerName: "Unit Price (NGN/kg)",
      type: 'numericColumn',
      minWidth: 150,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: "totalAmount",
      headerName: "Total (NGN)",
      type: 'numericColumn',
      minWidth: 150,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    }
  ], []);

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
    </div>
  );
}
