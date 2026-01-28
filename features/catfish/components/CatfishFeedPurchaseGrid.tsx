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

type PurchaseRow = {
  id: string;
  purchaseDate: string;
  quantityKg: number;
  unitPrice: number;
  totalAmount: number;
  product?: { name?: string };
};

export function CatfishFeedPurchaseGrid() {
  const [rowData, setRowData] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/internal-sales?targetModule=CATFISH');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Catfish feed purchase load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.purchases || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<PurchaseRow>[]>(() => [
    { field: 'purchaseDate', headerName: 'Date', minWidth: 120 },
    { headerName: 'Feed', minWidth: 180, valueGetter: (p: any) => p.data.product?.name || 'Unknown' },
    { field: 'quantityKg', headerName: 'Quantity (kg)', type: 'numericColumn', minWidth: 140 },
    {
      field: 'unitPrice',
      headerName: 'Unit Price (₦)',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: 'totalAmount',
      headerName: 'Total Amount (₦)',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
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

