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

type ProcessingRow = {
  id: string;
  processType: string;
  inputWeightKg: number;
  outputDryLarvaeKg: number;
  outputLarvaeOilLiters: number;
  outputLarvaeCakeKg: number;
  energyCostEstimate: number | null;
  runAt: string;
  batch?: { batchCode?: string };
};

export function BsfProcessingGrid() {
  const [rowData, setRowData] = useState<ProcessingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/bsf/processing');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Processing load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.runs || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<ProcessingRow>[]>(() => [
    { field: 'runAt', headerName: 'Run Date', minWidth: 150 },
    { headerName: 'Batch', minWidth: 140, valueGetter: (p: any) => p.data.batch?.batchCode || 'Unknown' },
    { field: 'processType', headerName: 'Type', minWidth: 150 },
    { field: 'inputWeightKg', headerName: 'Input (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'outputDryLarvaeKg', headerName: 'Dry (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'outputLarvaeOilLiters', headerName: 'Oil (L)', type: 'numericColumn', minWidth: 120 },
    { field: 'outputLarvaeCakeKg', headerName: 'Cake (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'energyCostEstimate', headerName: 'Energy', type: 'numericColumn', minWidth: 120 }
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
