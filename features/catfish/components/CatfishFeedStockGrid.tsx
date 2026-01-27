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

type StockRow = {
  id: string;
  name: string;
  unit: string;
  unitSizeKg?: number | null;
  quantityOnHand: number;
  averageUnitCost: number;
};

export function CatfishFeedStockGrid() {
  const [rowData, setRowData] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/location?code=CATFISH&module=FEED_MILL');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Catfish feed stock load error:', payload.error || response.statusText);
    } else {
      const items = (payload.items || []).filter((item: StockRow) => Number(item.quantityOnHand || 0) > 0);
      setRowData(items);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<StockRow>[]>(() => [
    {
      field: 'name',
      headerName: 'Feed',
      flex: 1.6,
      minWidth: 200,
      filter: true
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 100
    },
    {
      headerName: 'Stock (Unit)',
      flex: 1,
      type: 'numericColumn',
      valueGetter: (p: any) => Number(p.data.quantityOnHand || 0),
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      headerName: 'Stock (kg)',
      flex: 1,
      type: 'numericColumn',
      valueGetter: (p: any) => {
        const unitSize = Number(p.data.unitSizeKg || 0);
        const qty = Number(p.data.quantityOnHand || 0);
        return p.data.unit === 'BAG' && unitSize > 0 ? qty * unitSize : qty;
      },
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      headerName: 'Avg Cost',
      flex: 1,
      type: 'numericColumn',
      valueGetter: (p: any) => Number(p.data.averageUnitCost || 0),
      valueFormatter: (p: any) => `? ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
          overlayNoRowsTemplate="<span class='text-slate-500'>No records found</span>"
          pagination={true}
          paginationPageSize={20}
          theme={themeQuartz}
        />
      </div>
    </div>
  );
}

