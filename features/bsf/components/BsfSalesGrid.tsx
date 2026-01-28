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
import { Sale, Product, BsfLarvariumBatch } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type EnrichedSale = Sale & { batch?: { batchCode?: string } };

type StockProduct = Product & { quantityOnHand?: number };

export function BsfSalesGrid() {
  const [rowData, setRowData] = useState<EnrichedSale[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [batches, setBatches] = useState<BsfLarvariumBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    soldAt: new Date().toISOString().split('T')[0],
    productId: '',
    batchId: 'NONE',
    quantitySold: '',
    unitSellingPrice: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const [salesRes, productsRes, batchesRes] = await Promise.all([
      fetch('/api/sales?module=BSF'),
      fetch('/api/products?module=BSF'),
      fetch('/api/bsf/larvarium/batches')
    ]);

    const salesPayload = await salesRes.json().catch(() => ({}));
    const productsPayload = await productsRes.json().catch(() => ({}));
    const batchesPayload = await batchesRes.json().catch(() => ({}));

    if (salesRes.ok) setRowData(salesPayload.sales || []);
    if (productsRes.ok) {
      const filtered = (productsPayload.products || []).filter(
        (product: StockProduct) => product.name !== 'Wet Larvae'
      );
      setProducts(filtered);
    }
    if (batchesRes.ok) setBatches(batchesPayload.batches || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || Number(form.quantitySold) <= 0) return;

    setSubmitting(true);
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: form.productId,
        quantitySold: Number(form.quantitySold),
        unitSellingPrice: Number(form.unitSellingPrice),
        soldAt: form.soldAt,
        notes: form.notes,
        batchId: form.batchId === 'NONE' ? null : form.batchId
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log BSF sale.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        soldAt: new Date().toISOString().split('T')[0],
        productId: '',
        batchId: 'NONE',
        quantitySold: '',
        unitSellingPrice: '',
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<EnrichedSale>[]>(() => [
    { field: 'soldAt', headerName: 'Date', minWidth: 120 },
    { headerName: 'Product', minWidth: 160, valueGetter: (p: any) => p.data.product?.name || 'Unknown' },
    { headerName: 'Batch', minWidth: 140, valueGetter: (p: any) => p.data.batch?.batchCode || 'Unassigned' },
    { field: 'quantitySold', headerName: 'Quantity', type: 'numericColumn', minWidth: 120 },
    {
      field: 'unitSellingPrice',
      headerName: 'Unit Price (₦)',
      type: 'numericColumn',
      minWidth: 120,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      headerName: 'Revenue (₦)',
      type: 'numericColumn',
      minWidth: 140,
      valueGetter: (p: any) => Number(p.data.quantitySold || 0) * Number(p.data.unitSellingPrice || 0),
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    }
  ], []);

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
              <DialogTitle className="text-xl font-bold tracking-tight">Log BSF Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.soldAt} onChange={(e) => setForm({ ...form, soldAt: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={form.productId} onValueChange={(value) => setForm({ ...form, productId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
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
                  <Label>Batch (optional)</Label>
                  <Select value={form.batchId} onValueChange={(value) => setForm({ ...form, batchId: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Unassigned</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batchCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" step="0.01" value={form.quantitySold} onChange={(e) => setForm({ ...form, quantitySold: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (₦)</Label>
                  <Input type="number" step="0.01" value={form.unitSellingPrice} onChange={(e) => setForm({ ...form, unitSellingPrice: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
          pagination={true}
          paginationPageSize={20}
        />
      </div>
    </div>
  );
}



