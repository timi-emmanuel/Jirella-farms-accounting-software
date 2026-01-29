"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
 ColDef,
 ModuleRegistry,
 CellStyleModule,
 RowAutoHeightModule,
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
import { createClient } from '@/lib/supabase/client';
import { Loader2, Calendar } from 'lucide-react';
import { ActivityLog } from '@/types';

// Register modules
ModuleRegistry.registerModules([
 ClientSideRowModelModule,
 CellStyleModule,
 RowAutoHeightModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule
]);

export function ActivityLogGrid() {
 const [rowData, setRowData] = useState<ActivityLog[]>([]);
 const [loading, setLoading] = useState(true);

 const colDefs = useMemo<ColDef<ActivityLog>[]>(() => [
  {
   field: "timestamp",
   headerName: "Time",
   flex: 1,
   minWidth: 160,
   sort: 'desc',
   valueFormatter: (p: any) => {
    const parsed = new Date(p.value);
    const datePart = parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
    return `${datePart} ${parsed.toLocaleTimeString()}`;
   }
  },
  {
   headerName: "User",
   flex: 1.2,
   minWidth: 180,
   filter: true,
   valueGetter: (p: any) => {
    return p.data.userRole || 'Unknown';
   }
  },
  {
   field: "action",
   headerName: "Action",
   flex: 1.2,
   filter: true,
   cellRenderer: (p: any) => (
    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
     {p.value}
    </span>
   )
  },
  {
   headerName: "Target",
   width: 140,
   valueGetter: (p: any) => `${p.data.entityType} #${p.data.entityId || ''}`
  },
  {
   field: "description",
   headerName: "Description",
   flex: 2.5,
   minWidth: 250,
   filter: true,
   cellStyle: { whiteSpace: 'normal', lineHeight: '1.2em', padding: '8px' },
   autoHeight: true
  }
 ], []);

 useEffect(() => {
  const loadLogs = async () => {
   setLoading(true);
   const supabase = createClient();
   const { data, error } = await supabase
    .from('ActivityLog')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);

   console.log('Activity logs fetch result:', { data, error, count: data?.length });

   if (error) {
    console.error('Error fetching activity logs:', error);
   }

   if (data) setRowData(data as any);
   setLoading(false);
  };
  loadLogs();
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
      <Calendar className="w-12 h-12 mb-2 opacity-20" />
      <p>No activity logs found</p>
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
      paginationPageSize={50}
      theme={themeQuartz}
     />
    )}
   </div>
  </div>
 );
}
