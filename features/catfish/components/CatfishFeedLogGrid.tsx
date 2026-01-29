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
};

export function CatfishFeedLogGrid({ batchId, hideBatchColumn }: Props) {
  const [rowData, setRowData] = useState<CatfishFeedLog[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [products, setProducts] = useState<(Product & { quantityOnHand?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchId: batchId || '',
    date: new Date().toISOString().split('T')[0],
    feedProductId: '',
    quantityKg: ''
  });

  const loadData = async () => {
    setLoading(true);
    const query = batchId ? `?batchId=${batchId}` : '';
    const [logRes, batchRes, productRes] = await Promise.all([
      fetch(`/api/catfish/feed-logs${query}`),
      fetch('/api/catfish/batches'),
      fetch('/api/finished-goods/location?code=CATFISH&module=FEED_MILL')
    ]);

    const logPayload = await logRes.json().catch(() => ({}));
    const batchPayload = await batchRes.json().catch(() => ({}));
    const productPayload = await productRes.json().catch(() => ({}));

    if (logRes.ok) setRowData(logPayload.feedLogs || []);
    if (batchRes.ok) setBatches(batchPayload.batches || []);
    if (productRes.ok) {
      const items = (productPayload.items || []).filter((item: any) => Number(item.quantityOnHand || 0) > 0);
      setProducts(items);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId || !form.feedProductId) {
      toast({
        title: "Missing fields",
        description: "Please select a batch and feed product.",
        variant: "destructive"
      });
      return;
    }
    const qty = Number(form.quantityKg || 0);
    if (qty < 0) {
      toast({
        title: "Invalid feed",
        description: "Feed quantity cannot be negative.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    const response = await fetch('/api/catfish/feed-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: form.batchId,
        date: form.date,
        feedProductId: form.feedProductId,
        quantityKg: Number(form.quantityKg || 0)
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log feed usage.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        batchId: batchId || '',
        date: new Date().toISOString().split('T')[0],
        feedProductId: '',
        quantityKg: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<CatfishFeedLog>[]>(() => {
    const cols: ColDef<CatfishFeedLog>[] = [
      { field: 'date', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') }
    ];
    if (!hideBatchColumn) {
      cols.push({
        headerName: 'Batch',
        minWidth: 140,
        valueGetter: (p: any) => p.data.batch?.batchCode || 'Unknown'
      });
    }
    cols.push(
      { headerName: 'Feed', minWidth: 160, valueGetter: (p: any) => p.data.feedProduct?.name || 'Unknown' },
      { field: 'quantityKg', headerName: 'Quantity (kg)', type: 'numericColumn', minWidth: 140 },
      {
        field: 'unitCostAtTime',
        headerName: 'Unit Cost (₦)',
        type: 'numericColumn',
        minWidth: 130,
        valueFormatter: (p: any) => `${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      },
      {
        field: 'totalCost',
        headerName: 'Total Cost (₦)',
        type: 'numericColumn',
        minWidth: 140,
        valueFormatter: (p: any) => ` ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      }
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
              Log Feeding
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-140 max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log Feed Usage</DialogTitle>
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
                          {batch.batchCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Feed Product</Label>
                <Select value={form.feedProductId} onValueChange={(value) => setForm({ ...form, feedProductId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select feed" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity (kg)</Label>
                <Input type="number" step="0.01" min="0" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
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
          rowData={rowData}
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



