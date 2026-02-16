"use client";

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 ModuleRegistry,
 CellStyleModule,
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
import { Loader2, History } from 'lucide-react';

ModuleRegistry.registerModules([
 CellStyleModule,
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

type StoreHistoryRow = {
 id: string;
 type: string;
 direction: 'IN' | 'OUT';
 quantity: number;
 unitCost?: number | null;
 referenceType?: string | null;
 referenceId?: string | null;
 notes?: string | null;
 createdBy?: string | null;
 createdAt: string;
 item?: { name?: string; unit?: string };
};

export function StoreHistoryGrid() {
 const [rowData, setRowData] = useState<StoreHistoryRow[]>([]);
 const [loading, setLoading] = useState(true);

 const colDefs = useMemo<ColDef<StoreHistoryRow>[]>(() => [
  {
   field: 'createdAt',
   headerName: 'Date/Time',
   flex: 1.2,
   minWidth: 170,
   sort: 'desc',
   valueFormatter: (p: any) => {
    const parsed = new Date(p.value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    const datePart = parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${datePart} ${parsed.toLocaleTimeString()}`;
   }
  },
  {
   headerName: 'Item',
   flex: 1.4,
   minWidth: 160,
   filter: true,
   valueGetter: (p: any) => p.data.item?.name || 'Unknown'
  },
  {
   field: 'type',
   headerName: 'Activity',
   width: 130,
   filter: true,
   cellRenderer: (p: any) => {
    const text = `${p.data.type} (${p.data.direction})`;
    const isIn = p.data.direction === 'IN';
    const color = isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${color}`}>{text}</span>;
   }
  },
  {
   field: 'quantity',
   headerName: 'Qty',
   width: 100,
   type: 'numericColumn',
   valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   headerName: 'Unit',
   width: 90,
   valueGetter: (p: any) => p.data.item?.unit || ''
  },
  {
   field: 'unitCost',
   headerName: 'Unit Cost',
   width: 120,
   type: 'numericColumn',
   valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   headerName: 'Total',
   width: 130,
   type: 'numericColumn',
   valueGetter: (p: any) => {
    const qty = Number(p.data.quantity || 0);
    const unitCost = Number(p.data.unitCost || 0);
    return qty * unitCost;
   },
   valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   field: 'referenceType',
   headerName: 'Reference',
   flex: 1.1,
   minWidth: 140,
   filter: true,
   valueGetter: (p: any) => p.data.referenceType || '-'
  },
  {
   field: 'notes',
   headerName: 'Notes',
   flex: 1.8,
   minWidth: 220,
   filter: true
  }
 ], []);

 useEffect(() => {
  const loadHistory = async () => {
   setLoading(true);
   const response = await fetch('/api/store/history');
   const payload = await response.json().catch(() => ({}));
   if (!response.ok) {
    console.error('Error loading store history:', payload.error || response.statusText);
   } else {
    setRowData(payload.history || []);
   }
   setLoading(false);
  };
  loadHistory();
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
      <History className="w-12 h-12 mb-2 opacity-20" />
      <p>No store history found</p>
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
