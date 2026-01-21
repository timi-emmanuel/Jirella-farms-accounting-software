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

const formatDate = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
};

type HarvestRow = {
  id: string;
  createdAt: string;
  wetLarvaeKg: number;
  frassKg: number;
  residueWasteKg: number;
  processedWetKg?: number;
  remainingWetKg?: number;
  batch?: { batchCode?: string };
};

export function BsfHarvestGrid() {
  const [rowData, setRowData] = useState<HarvestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/bsf/harvests');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Harvest load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.harvests || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<HarvestRow>[]>(() => [
    { field: 'createdAt', headerName: 'Date', minWidth: 140, valueFormatter: (p) => formatDate(p.value) },
    { headerName: 'Batch', minWidth: 140, valueGetter: (p: any) => p.data.batch?.batchCode || 'Unknown' },
    { field: 'wetLarvaeKg', headerName: 'Live Larvae (kg)', type: 'numericColumn', minWidth: 150 },
    { field: 'processedWetKg', headerName: 'Processed (kg)', type: 'numericColumn', minWidth: 140 },
    { field: 'remainingWetKg', headerName: 'Remaining (kg)', type: 'numericColumn', minWidth: 140 },
    { field: 'frassKg', headerName: 'Frass (kg)', type: 'numericColumn', minWidth: 130 },
    { field: 'residueWasteKg', headerName: 'Residue (kg)', type: 'numericColumn', minWidth: 130 }
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
