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
import { Loader2, CheckCircle2, XCircle, PackageCheck } from 'lucide-react';
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
import { toast } from "@/lib/toast";

type TransferLine = {
  product?: { name?: string; unit?: string; unitSizeKg?: number | null };
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

export function FinishedFeedTransferGrid() {
  const [rowData, setRowData] = useState<TransferRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<TransferRequestRow | null>(null);
  const [completeNotes, setCompleteNotes] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/transfers');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Error loading finished feed transfers:', payload.error || response.statusText);
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
      ? `/api/finished-goods/transfers/${request.id}/approve`
      : `/api/finished-goods/transfers/${request.id}/reject`;

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
    }
    setProcessingId(null);
  };

  const handleComplete = async () => {
    if (!completeTarget) return;
    setProcessingId(completeTarget.id);

    const response = await fetch(`/api/finished-goods/transfers/${completeTarget.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: completeNotes })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to complete transfer.',
        variant: "destructive"
      });
    } else {
      setRowData(prev => prev.map(r => r.id === completeTarget.id ? { ...r, status: 'COMPLETED' } : r));
      setCompleteDialogOpen(false);
      setCompleteTarget(null);
      setCompleteNotes('');
    }
    setProcessingId(null);
  };

  const colDefs = useMemo<ColDef<TransferRequestRow>[]>(() => [
    {
      headerName: "Feed Requested",
      flex: 1.5,
      minWidth: 160,
      filter: true,
      valueGetter: (p: any) => p.data.lines?.[0]?.product?.name || 'Unknown'
    },
    {
      headerName: "Qty (Unit)",
      width: 110,
      type: 'numericColumn',
      valueGetter: (p: any) => p.data.lines?.[0]?.quantityRequested ?? 0
    },
    {
      headerName: "Qty (kg)",
      width: 110,
      type: 'numericColumn',
      valueGetter: (p: any) => {
        const line = p.data.lines?.[0];
        const unit = line?.product?.unit;
        const unitSize = Number(line?.product?.unitSizeKg || 0);
        const qty = Number(line?.quantityRequested || 0);
        if (unit === 'BAG' && unitSize > 0) return qty * unitSize;
        return qty;
      }
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
      valueFormatter: (p: any) => new Date(p.value).toLocaleDateString(),
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
                className="bg-emerald-600 hover:bg-emerald-700 h-8 px-2"
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
                setCompleteTarget(request);
                setCompleteNotes('');
                setCompleteDialogOpen(true);
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

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="completeNotes">Notes</Label>
              <Textarea
                id="completeNotes"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Issued to poultry, batch details, etc."
              />
            </div>
            <DialogFooter>
              <Button onClick={handleComplete} disabled={processingId === completeTarget?.id}>
                {processingId === completeTarget?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Complete Transfer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

