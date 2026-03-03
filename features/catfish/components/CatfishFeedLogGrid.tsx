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
import { CatfishBatch, CatfishFeedLog, Product } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  mode?: 'all' | 'mortality' | 'feed';
  productionType?: 'Fingerlings' | 'Juvenile' | 'Melange';
  stageLabel?: string;
};

export function CatfishFeedLogGrid({
  batchId,
  hideBatchColumn,
  mode = 'all',
  productionType = 'Fingerlings',
  stageLabel = 'Fingerlings'
}: Props) {
  const [rowData, setRowData] = useState<CatfishFeedLog[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [products, setProducts] = useState<(Product & { quantityOnHand?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchId: batchId || '',
    logDate: new Date().toISOString().split('T')[0],
    feedProductId: 'NONE',
    feedAmountKg: '',
    feedUnitPrice: '',
    mortalityCount: '',
    abwGrams: '',
    averageLengthCm: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const query = batchId ? `?batchId=${batchId}` : '';
    const [logRes, batchRes, productRes] = await Promise.all([
      fetch(`/api/catfish/feed-logs${query}`),
      fetch(`/api/catfish/batches?productionType=${productionType}`),
      fetch('/api/finished-goods/location?code=CATFISH&module=FEED_MILL')
    ]);

    const logPayload = await logRes.json().catch(() => ({}));
    const batchPayload = await batchRes.json().catch(() => ({}));
    const productPayload = await productRes.json().catch(() => ({}));

    if (logRes.ok) setRowData(logPayload.feedLogs || []);
    if (batchRes.ok) setBatches(batchPayload.batches || []);
    if (productRes.ok) {
      const available = (productPayload.items || []).filter((item: any) => Number(item.quantityOnHand || 0) > 0);
      setProducts(available);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [batchId, productionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId) {
      toast({ title: "Missing fields", description: "Please select a batch.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const response = await fetch('/api/catfish/feed-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: form.batchId,
        logDate: form.logDate,
        feedProductId: form.feedProductId === 'NONE' ? null : form.feedProductId,
        feedAmountKg: Number(form.feedAmountKg || 0),
        feedUnitPrice: Number(form.feedUnitPrice || 0),
        mortalityCount: Number(form.mortalityCount || 0),
        abwGrams: form.abwGrams ? Number(form.abwGrams) : null,
        averageLengthCm: form.averageLengthCm ? Number(form.averageLengthCm) : null,
        notes: form.notes || null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to create daily log.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        batchId: batchId || '',
        logDate: new Date().toISOString().split('T')[0],
        feedProductId: 'NONE',
        feedAmountKg: '',
        feedUnitPrice: '',
        mortalityCount: '',
        abwGrams: '',
        averageLengthCm: '',
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<CatfishFeedLog>[]>(() => {
    if (mode === 'mortality') {
      const cols: ColDef<CatfishFeedLog>[] = [
        { field: 'logDate', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') }
      ];
      if (!hideBatchColumn) {
        cols.push({
          headerName: 'Batch',
          minWidth: 160,
          valueGetter: (p: any) => p.data.batch?.batchName || 'Unknown'
        });
      }
      cols.push(
        { field: 'mortalityCount', headerName: 'Mortality', type: 'numericColumn', minWidth: 120 },
        { field: 'notes', headerName: 'Notes', minWidth: 200, flex: 1 }
      );
      return cols;
    }

    const cols: ColDef<CatfishFeedLog>[] = [
      { field: 'logDate', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') }
    ];
    if (!hideBatchColumn) {
      cols.push({
        headerName: 'Batch',
        minWidth: 160,
        valueGetter: (p: any) => p.data.batch?.batchName || 'Unknown'
      });
    }
    cols.push(
      { headerName: 'Feed Product', minWidth: 160, valueGetter: (p: any) => p.data.feedProduct?.name || '-' },
      { field: 'feedAmountKg', headerName: 'Feed (kg)', type: 'numericColumn', minWidth: 120 },
      {
        field: 'feedUnitPrice',
        headerName: 'Unit Price (₦)',
        type: 'numericColumn',
        minWidth: 130,
        valueFormatter: (p: any) => `${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      },
      {
        field: 'dailyFeedCost',
        headerName: 'Feed Cost (₦)',
        type: 'numericColumn',
        minWidth: 130,
        valueFormatter: (p: any) => `${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      },
      { field: 'mortalityCount', headerName: 'Mortality', type: 'numericColumn', minWidth: 110 },
      { field: 'abwGrams', headerName: 'ABW (g)', type: 'numericColumn', minWidth: 100, valueFormatter: (p: any) => p.value ? Number(p.value).toLocaleString() : '-' },
      { field: 'averageLengthCm', headerName: 'Length (cm)', type: 'numericColumn', minWidth: 110, valueFormatter: (p: any) => p.value ? Number(p.value).toLocaleString() : '-' },
      { field: 'notes', headerName: 'Notes', minWidth: 180, flex: 1 }
    );
    return cols;
  }, [hideBatchColumn, mode]);

  const displayedRows = useMemo(() => {
    if (mode === 'mortality') {
      return rowData.filter((row) => Number(row.mortalityCount || 0) > 0);
    }
    if (mode === 'feed') {
      return rowData.filter((row) => Number(row.feedAmountKg || 0) > 0);
    }
    return rowData;
  }, [rowData, mode]);

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
              New Daily Log
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Create {stageLabel} Daily Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Input type="date" value={form.logDate} onChange={(e) => setForm({ ...form, logDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Feed Product (optional)</Label>
                <Select value={form.feedProductId} onValueChange={(value) => setForm({ ...form, feedProductId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select feed product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({Number(product.quantityOnHand || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {product.unit || ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Feed Amount (kg)</Label>
                <Input type="number" min="0" step="0.01" value={form.feedAmountKg} onChange={(e) => setForm({ ...form, feedAmountKg: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Feed Unit Price (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={form.feedUnitPrice} onChange={(e) => setForm({ ...form, feedUnitPrice: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Mortality</Label>
                  <Input type="number" min="0" step="1" value={form.mortalityCount} onChange={(e) => setForm({ ...form, mortalityCount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ABW (grams)</Label>
                <Input type="number" min="0" step="0.01" value={form.abwGrams} onChange={(e) => setForm({ ...form, abwGrams: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Average Length (cm)</Label>
                <Input type="number" min="0" step="0.01" value={form.averageLengthCm} onChange={(e) => setForm({ ...form, averageLengthCm: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Log
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="h-80 border rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/50">
        <AgGridReact
          theme={themeQuartz}
          rowData={displayedRows}
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
