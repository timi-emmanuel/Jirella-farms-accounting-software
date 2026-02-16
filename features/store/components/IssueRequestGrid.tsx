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
 RowSelectionModule,
 PaginationModule,
 RowStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule,
 themeQuartz
} from 'ag-grid-community';
import { Loader2, CheckCircle2, XCircle, PackageCheck } from 'lucide-react';
import { toast } from "@/lib/toast";
type TransferLine = {
 item?: { name?: string; unit?: string };
 quantityRequested: number;
 quantityTransferred?: number | null;
};

type TransferRequestRow = {
 id: string;
 status: string;
 createdAt: string;
 notes?: string | null;
 lines?: TransferLine[];
 from?: { code?: string };
 to?: { code?: string };
};
import { Button } from '@/components/ui/button';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Register modules
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

export function IssueRequestGrid() {
 const [rowData, setRowData] = useState<TransferRequestRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [processingId, setProcessingId] = useState<string | null>(null);
 const [issueDialogOpen, setIssueDialogOpen] = useState(false);
 const [issueTarget, setIssueTarget] = useState<TransferRequestRow | null>(null);
 const [issueNotes, setIssueNotes] = useState('');

 const loadRequests = async () => {
  setLoading(true);
 const response = await fetch('/api/transfers');
 const payload = await response.json().catch(() => ({}));
 if (!response.ok) {
   const message = payload.error || response.statusText;
   console.error('Error loading transfer requests:', message);
   toast({
    title: "Error",
    description: `Failed to load transfer requests: ${message}`,
    variant: "destructive"
   });
  }
  setRowData(payload.requests || []);
  setLoading(false);
 };

 useEffect(() => {
  loadRequests();
 }, []);

 const handleAction = async (request: TransferRequestRow, action: 'APPROVED' | 'REJECTED') => {
  setProcessingId(request.id);
  const endpoint = action === 'APPROVED'
   ? `/api/transfers/${request.id}/approve`
   : `/api/transfers/${request.id}/reject`;

  const response = await fetch(endpoint, { method: 'POST' });
 if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  toast({
   title: "Error",
   description: payload.error || `Failed to ${action.toLowerCase()} request.`,
   variant: "destructive"
  });
 } else {
  setRowData(prev => prev.map(r => r.id === request.id ? { ...r, status: action } : r));
  toast({
   title: "Success",
   description: action === 'APPROVED' ? 'Transfer request approved.' : 'Transfer request rejected.',
   variant: "success"
  });
 }
  setProcessingId(null);
 };

 const handleIssue = async () => {
  if (!issueTarget) return;
  setProcessingId(issueTarget.id);

  const response = await fetch(`/api/transfers/${issueTarget.id}/complete`, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    notes: issueNotes
   })
  });

 if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  toast({
   title: "Error",
   description: payload.error || 'Failed to issue stock.',
   variant: "destructive"
  });
 } else {
   setRowData(prev => prev.map(r => r.id === issueTarget.id ? { ...r, status: 'COMPLETED' } : r));
   setIssueDialogOpen(false);
   setIssueTarget(null);
   setIssueNotes('');
   toast({
    title: "Success",
    description: "Transfer completed and inventory updated.",
    variant: "success"
   });
  }
  setProcessingId(null);
 };

 const colDefs = useMemo<ColDef<TransferRequestRow>[]>(() => [
  {
   headerName: "Item Requested",
   flex: 1.5,
   minWidth: 160,
   filter: true,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.name || 'Unknown'
  },
  {
   headerName: "Qty",
   width: 100,
   type: 'numericColumn',
   valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
  },
  {
   headerName: "Unit",
   width: 90,
   valueGetter: (p: any) => p.data.lines?.[0]?.item?.unit || ''
  },
  {
   headerName: "Destination",
   width: 140,
   filter: true,
   valueGetter: (p: any) => p.data.to?.code || ''
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
   field: "createdAt",
   headerName: "Date Requested",
   flex: 1,
   valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-'),
   sort: 'desc'
  },
  {
   headerName: "Actions",
   width: 220,
   pinned: 'right',
   sortable: false,
   filter: false,
   cellRenderer: (params: any) => {
    const request = params.data as TransferRequestRow;
    const isProcessing = processingId === request.id;

    if (request.status === 'PENDING') {
     return (
      <div className="flex items-center gap-2 h-full">
       <Button
        size="sm"
        className="bg-emerald-700 hover:bg-emerald-800 h-8 px-2"
        disabled={isProcessing}
        onClick={() => handleAction(request, 'APPROVED')}
       >
        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
        Approve
       </Button>
       <Button
        size="sm"
        variant="destructive"
        className="h-8 px-2"
        disabled={isProcessing}
        onClick={() => handleAction(request, 'REJECTED')}
       >
        <XCircle className="w-4 h-4 mr-1" />
        Reject
       </Button>
      </div>
     );
    }

    if (request.status === 'APPROVED') {
     return (
      <Button
       size="sm"
       className="bg-blue-600 hover:bg-blue-700 h-8 px-2"
       disabled={isProcessing}
       onClick={() => {
        setIssueTarget(request);
        setIssueNotes('');
        setIssueDialogOpen(true);
       }}
      >
       <PackageCheck className="w-4 h-4 mr-1" />
       Complete
      </Button>
     );
    }

    return null;
   }
  }
 ], [processingId]);

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
      <PackageCheck className="w-12 h-12 mb-2 opacity-20" />
      <p>No transfer requests found</p>
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

   <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
    <DialogContent>
     <DialogHeader>
     <DialogTitle>Complete Transfer</DialogTitle>
     </DialogHeader>
     <div className="space-y-4">
      <div className="space-y-2">
       <Label htmlFor="issueNotes">Notes</Label>
       <Textarea
        id="issueNotes"
        value={issueNotes}
        onChange={(e) => setIssueNotes(e.target.value)}
        placeholder="Issued to module, batch details, etc."
       />
      </div>
      <DialogFooter>
       <Button onClick={handleIssue} disabled={processingId === issueTarget?.id}>
        {processingId === issueTarget?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Complete Transfer
       </Button>
      </DialogFooter>
     </div>
    </DialogContent>
   </Dialog>
  </div>
 );
}


