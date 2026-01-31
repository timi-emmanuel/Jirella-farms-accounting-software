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
import { Sale, Product, CatfishBatch } from '@/types';
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

type EnrichedSale = Sale & { catfishBatch?: { batchCode?: string } };

type StockProduct = Product & { quantityOnHand?: number };

export function CatfishSalesGrid() {
  const [rowData, setRowData] = useState<EnrichedSale[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    soldAt: new Date().toISOString().split('T')[0],
    productId: '',
    batchId: 'NONE',
    quantitySold: '',
    unitSellingPrice: '',
    notes: '',
    customerName: '',
    customerContact: '',
    customerAddress: ''
  });

  const loadData = async () => {
    setLoading(true);
    const [salesRes, productsRes, batchesRes] = await Promise.all([
      fetch('/api/sales?module=CATFISH'),
      fetch('/api/products?module=CATFISH'),
      fetch('/api/catfish/batches')
    ]);

    const salesPayload = await salesRes.json().catch(() => ({}));
    const productsPayload = await productsRes.json().catch(() => ({}));
    const batchesPayload = await batchesRes.json().catch(() => ({}));

    if (salesRes.ok) setRowData(salesPayload.sales || []);
    if (productsRes.ok) setProducts(productsPayload.products || []);
    if (batchesRes.ok) setBatches(batchesPayload.batches || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || Number(form.quantitySold) <= 0) return;
    if (!form.customerName.trim()) {
      toast({ title: "Missing customer", description: "Customer name is required for external sales.", variant: "destructive" });
      return;
    }
    const selectedProduct = products.find((p) => p.id === form.productId);
    if (selectedProduct && Number(form.quantitySold) > Number(selectedProduct.quantityOnHand || 0)) {
      toast({ title: "Error", description: "Insufficient stock for this sale.", variant: "destructive" });
      return;
    }

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
        batchId: form.batchId === 'NONE' ? null : form.batchId,
        customerName: form.customerName,
        customerContact: form.customerContact || null,
        customerAddress: form.customerAddress || null
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
        soldAt: new Date().toISOString().split('T')[0],
        productId: '',
        batchId: 'NONE',
        quantitySold: '',
        unitSellingPrice: '',
        notes: '',
        customerName: '',
        customerContact: '',
        customerAddress: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<EnrichedSale>[]>(() => [
    { field: 'soldAt', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') },
    { headerName: 'Product', minWidth: 160, valueGetter: (p: any) => p.data.product?.name || 'Unknown' },
    {
      headerName: 'Batch',
      minWidth: 140,
      valueGetter: (p: any) => {
        const batchId = p.data.batchId;
        const fromJoin = p.data.catfishBatch?.batchCode;
        if (fromJoin) return fromJoin;
        if (!batchId) return 'Unassigned';
        const matched = batches.find((batch) => batch.id === batchId);
        return matched?.batchCode || 'Unassigned';
      }
    },
    {
      headerName: 'Customer Name',
      minWidth: 160,
      valueGetter: (p: any) => {
        const saleType = p.data.saleType ?? 'EXTERNAL';
        if (saleType !== 'EXTERNAL') return '-';
        return p.data.customerName || '-';
      }
    },
    {
      headerName: 'Contact',
      minWidth: 140,
      valueGetter: (p: any) => {
        const saleType = p.data.saleType ?? 'EXTERNAL';
        if (saleType !== 'EXTERNAL') return '-';
        return p.data.customerContact || '-';
      }
    },
    {
      headerName: 'Address',
      minWidth: 180,
      valueGetter: (p: any) => {
        const saleType = p.data.saleType ?? 'EXTERNAL';
        if (saleType !== 'EXTERNAL') return '-';
        return p.data.customerAddress || '-';
      }
    },
    { field: 'quantitySold', headerName: 'Quantity (kg)', type: 'numericColumn', minWidth: 120 },
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
  ], [batches]);

  const selectedProduct = products.find((p) => p.id === form.productId);
  const selectedStock = Number(selectedProduct?.quantityOnHand || 0);

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
          <DialogContent className="sm:max-w-140 max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log Catfish Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.soldAt} onChange={(e) => setForm({ ...form, soldAt: e.target.value })} />
              </div>
              <div className='grid grid-cols-2 gap-3'>
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
                  <Label>Quantity (kg)</Label>
                  <Input type="number" step="0.01" value={form.quantitySold} onChange={(e) => setForm({ ...form, quantitySold: e.target.value })} />
                  <p className="text-xs text-slate-500">
                    Available: {selectedStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedProduct?.unit || ''}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (₦)</Label>
                  <Input type="number" step="0.01" value={form.unitSellingPrice} onChange={(e) => setForm({ ...form, unitSellingPrice: e.target.value })} />
                </div>
              </div>              
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Customer Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input value={form.customerContact} onChange={(e) => setForm({ ...form, customerContact: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
                </div>
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



