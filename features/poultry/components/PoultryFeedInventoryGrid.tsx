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
import { Loader2, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FeedProduct = {
  id: string;
  name: string;
  unit: string;
  unitSizeKg?: number | null;
  quantityOnHand: number;
  averageUnitCost: number;
};

type RequestForm = {
  productId: string;
  quantityKg: string;
  notes: string;
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

export function PoultryFeedInventoryGrid() {
  const [rowData, setRowData] = useState<FeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestForm>({
    productId: '',
    quantityKg: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/location?code=POULTRY&module=FEED_MILL');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Finished feed load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.items || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<FeedProduct>[]>(() => [
    {
      field: "name",
      headerName: "Feed",
      flex: 1.6,
      minWidth: 180,
      filter: true
    },
    {
      field: "unit",
      headerName: "Unit",
      width: 100,
      cellRenderer: (params: any) => (
        <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
          {params.value}
        </span>
      )
    },
    {
      headerName: "Stock (Unit)",
      flex: 1,
      type: 'numericColumn',
      valueGetter: (p: any) => Number(p.data.quantityOnHand || 0),
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    {
      headerName: "Stock (kg)",
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
      headerName: "Actions",
      width: 140,
      cellRenderer: (params: any) => (
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => {
            setRequestForm({ productId: params.data.id, quantityKg: '', notes: '' });
            setDialogOpen(true);
          }}
        >
          <PackagePlus className="w-4 h-4 mr-2" />
          Request
        </Button>
      )
    }
  ], []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.productId || !requestForm.quantityKg || Number(requestForm.quantityKg) <= 0) {
      alert('Enter a valid quantity.');
      return;
    }

    setRequesting(true);
    const response = await fetch('/api/finished-goods/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: requestForm.productId,
        quantityKg: Number(requestForm.quantityKg),
        notes: requestForm.notes
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'Failed to submit request.');
    } else {
      setDialogOpen(false);
      setRequestForm({ productId: '', quantityKg: '', notes: '' });
      alert('Request made successfully.');
    }
    setRequesting(false);
  };

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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request from Feed Mill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requestQty">Quantity (kg)</Label>
              <Input
                id="requestQty"
                type="number"
                step="0.01"
                value={requestForm.quantityKg}
                onChange={(e) => setRequestForm({ ...requestForm, quantityKg: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestNotes">Notes (optional)</Label>
              <Textarea
                id="requestNotes"
                value={requestForm.notes}
                onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                placeholder="Usage reason or urgency"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={requesting}>
                {requesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
