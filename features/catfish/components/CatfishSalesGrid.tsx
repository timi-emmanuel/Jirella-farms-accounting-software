/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
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
import { toast } from "@/lib/toast";
import { Loader2, Plus } from 'lucide-react';
import { CatfishBatch, CatfishSale } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

type Props = {
  batchId?: string;
  hideBatchColumn?: boolean;
  productionType?: 'Fingerlings' | 'Juvenile' | 'Melange';
  stageLabel?: string;
};

export function CatfishSalesGrid({
  batchId,
  hideBatchColumn,
  productionType = 'Fingerlings',
  stageLabel = 'Fingerlings'
}: Props) {
  const [rowData, setRowData] = useState<CatfishSale[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    batchId: batchId || '',
    saleDate: new Date().toISOString().split('T')[0],
    saleType: 'Partial Offload',
    quantitySold: '',
    unitPrice: '',
    buyerDetails: ''
  });

  const loadData = async () => {
    setLoading(true);
    const query = batchId ? `?batchId=${batchId}` : '';
    const [salesRes, batchesRes] = await Promise.all([
      fetch(`/api/catfish/sales${query}`),
      fetch(`/api/catfish/batches?productionType=${productionType}`)
    ]);

    const salesPayload = await salesRes.json().catch(() => ({}));
    const batchesPayload = await batchesRes.json().catch(() => ({}));

    if (salesRes.ok) setRowData(salesPayload.sales || []);
    if (batchesRes.ok) setBatches((batchesPayload.batches || []).filter((batch: any) => batch.status === 'Active'));

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [batchId, productionType]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId || Number(form.quantitySold) <= 0) return;

    setSubmitting(true);
    const response = await fetch('/api/catfish/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: form.batchId,
        saleDate: form.saleDate,
        saleType: form.saleType,
        quantitySold: Number(form.quantitySold),
        unitPrice: Number(form.unitPrice),
        buyerDetails: form.buyerDetails || null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log catfish sale.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        batchId: batchId || '',
        saleDate: new Date().toISOString().split('T')[0],
        saleType: 'Partial Offload',
        quantitySold: '',
        unitPrice: '',
        buyerDetails: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<CatfishSale>[]>(() => {
    const cols: ColDef<CatfishSale>[] = [
      { field: 'saleDate', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') }
    ];
    if (!hideBatchColumn) {
      cols.push({
        headerName: 'Batch',
        minWidth: 160,
        valueGetter: (p: any) => p.data.batch?.batchName || 'Unknown'
      });
    }
    cols.push(
      { field: 'saleType', headerName: 'Sale Type', minWidth: 140 },
      { field: 'quantitySold', headerName: 'Qty Sold', type: 'numericColumn', minWidth: 110 },
      {
        field: 'unitPrice',
        headerName: 'Unit Price (₦)',
        type: 'numericColumn',
        minWidth: 130,
        valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
      },
      {
        field: 'totalSaleValue',
        headerName: 'Total Value (₦)',
        type: 'numericColumn',
        minWidth: 140,
        valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
      },
      { field: 'buyerDetails', headerName: 'Buyer Details', minWidth: 200, flex: 1 }
    );
    return cols;
  }, [hideBatchColumn]);

  if (loading && rowData.length === 0) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6">
              <Plus className="w-4 h-4" />
              Log Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log {stageLabel} Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              {!batchId && (
                <div className="space-y-2">
                  <Label>Batch</Label>
                  <Select value={form.batchId} onValueChange={(value) => setForm({ ...form, batchId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batchName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sale Type</Label>
                <Select value={form.saleType} onValueChange={(value) => setForm({ ...form, saleType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Partial Offload">Partial Offload</SelectItem>
                    <SelectItem value="Final Clear-Out">Final Clear-Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity Sold</Label>
                  <Input type="number" min="1" step="1" value={form.quantitySold} onChange={(e) => setForm({ ...form, quantitySold: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Buyer Details</Label>
                <Textarea value={form.buyerDetails} onChange={(e) => setForm({ ...form, buyerDetails: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Log Sale
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
          overlayNoRowsTemplate="<span class='text-slate-500'>No sales found</span>"
          pagination={true}
          paginationPageSize={20}
        />
      </div>
    </div>
  );
}
