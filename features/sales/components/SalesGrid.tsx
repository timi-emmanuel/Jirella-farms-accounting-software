"use client"

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
import { toast } from "@/lib/toast";
import { Loader2, Plus, TrendingUp } from 'lucide-react';
import { Sale, Product } from '@/types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
 DialogFooter,
} from "@/components/ui/dialog";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";

type ModuleFilter = 'ALL' | 'FEED_MILL' | 'POULTRY' | 'BSF' | 'CATFISH';

// Register AG Grid modules
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

export function SalesGrid({
  initialModule = 'ALL',
  showModuleFilter = true,
  showStockColumn = true
}: {
  initialModule?: ModuleFilter;
  showModuleFilter?: boolean;
  showStockColumn?: boolean;
}) {
 const [rowData, setRowData] = useState<Sale[]>([]);
 const [products, setProducts] = useState<(Product & { quantityOnHand?: number; averageUnitCost?: number })[]>([]);
 const [loading, setLoading] = useState(true);
 const [showAddSale, setShowAddSale] = useState(false);
 const [showAddProduct, setShowAddProduct] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [creatingProduct, setCreatingProduct] = useState(false);
 const [moduleFilter, setModuleFilter] = useState<ModuleFilter>(initialModule);

 const [newSale, setNewSale] = useState({
  productId: '',
  quantitySold: '',
  unitSellingPrice: '',
  soldAt: new Date().toISOString().split('T')[0],
  notes: ''
 });

 const [newProduct, setNewProduct] = useState({
  name: '',
  module: 'FEED_MILL' as ModuleFilter,
  unit: ''
 });

 const loadSales = async (moduleValue: ModuleFilter) => {
  setLoading(true);
  const response = await fetch(`/api/sales?module=${moduleValue}`);
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
   setRowData(payload.sales || []);
  } else {
   console.error('Sales load error:', payload.error || response.statusText);
  }
  setLoading(false);
 };

 const loadProducts = async (moduleValue: ModuleFilter) => {
  const response = await fetch(`/api/products?module=${moduleValue}`);
  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
   setProducts(payload.products || []);
  } else {
   console.error('Products load error:', payload.error || response.statusText);
  }
 };

 useEffect(() => {
  loadSales(moduleFilter);
  loadProducts(moduleFilter);
 }, [moduleFilter]);

 const handleAddSale = async (e: React.FormEvent) => {
  e.preventDefault();
 if (!newSale.productId || Number(newSale.quantitySold) <= 0) return;
 if (selectedProduct && Number(newSale.quantitySold) > Number(selectedProduct.quantityOnHand || 0)) {
   toast({ title: "Error", description: "Insufficient stock for this sale.", variant: "destructive" });
   return;
 }
  setSubmitting(true);

  const response = await fetch('/api/sales', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    productId: newSale.productId,
    quantitySold: Number(newSale.quantitySold),
    unitSellingPrice: Number(newSale.unitSellingPrice),
    soldAt: newSale.soldAt,
    notes: newSale.notes
   })
  });

 if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  toast({
   title: "Error",
   description: payload.error || 'Failed to log sale.',
   variant: "destructive"
  });
 } else {
   setShowAddSale(false);
   setNewSale({
    productId: '',
    quantitySold: '',
    unitSellingPrice: '',
    soldAt: new Date().toISOString().split('T')[0],
    notes: ''
   });
   loadSales(moduleFilter);
  }
  setSubmitting(false);
 };

 const handleAddProduct = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newProduct.name || !newProduct.unit || newProduct.module === 'ALL') return;
  setCreatingProduct(true);

  const response = await fetch('/api/products', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    name: newProduct.name,
    module: newProduct.module,
    unit: newProduct.unit
   })
  });

 if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  toast({
   title: "Error",
   description: payload.error || 'Failed to create product.',
   variant: "destructive"
  });
 } else {
   setShowAddProduct(false);
   setNewProduct({ name: '', module: 'FEED_MILL', unit: '' });
   loadProducts(moduleFilter);
  }
  setCreatingProduct(false);
 };

 const stockByProductId = useMemo(() => {
  return new Map(products.map((product) => [product.id, product]));
 }, [products]);

 const colDefs: ColDef<Sale>[] = useMemo(() => {
  const columns: ColDef<Sale>[] = [
  {
   field: "soldAt",
   headerName: "Date",
   flex: 1,
   minWidth: 120
  },
  {
   headerName: "Product",
   flex: 1.5,
   minWidth: 180,
   valueGetter: (p: any) => p.data.product?.name || 'Unknown'
  },
  {
   field: "module",
   headerName: "Module",
   width: 120,
   filter: true
  },
  {
   field: "quantitySold",
   headerName: "Quantity",
   type: 'numericColumn',
   filter: false,
   flex: 1
  },
  {
   field: "unitSellingPrice",
   headerName: "Unit Price (₦)",
   type: 'numericColumn',
   flex: 1,
   filter: false,
   valueFormatter: (p: any) => `${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  },
  {
   headerName: "Revenue",
   type: 'numericColumn',
   filter: false,
   flex: 1,
   valueGetter: (p: any) => Number(p.data.quantitySold) * Number(p.data.unitSellingPrice),
   valueFormatter: (p: any) => ` ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  },
  {
   headerName: "COGS",
   type: 'numericColumn',
   filter: false,
   flex: 1,
   valueGetter: (p: any) => Number(p.data.quantitySold) * Number(p.data.unitCostAtSale || 0),
   valueFormatter: (p: any) => ` ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  },
  {
   headerName: "Gross Profit (₦)",
   type: 'numericColumn',
   filter: false,
   flex: 1,
   valueGetter: (p: any) => {
    const rev = Number(p.data.quantitySold) * Number(p.data.unitSellingPrice);
    const cogs = Number(p.data.quantitySold) * Number(p.data.unitCostAtSale || 0);
    return rev - cogs;
   },
   cellRenderer: (p: any) => (
    <span className={p.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
      {Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </span>
   )
  }
  ];

  if (showStockColumn) {
    columns.splice(3, 0, {
      headerName: "Current Stock",
      type: 'numericColumn',
      flex: 1,
      filter: false,
      valueGetter: (p: any) => {
        const product = stockByProductId.get(p.data.productId);
        return Number(product?.quantityOnHand || 0);
      },
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    });
  }

  return columns;
 }, [stockByProductId, showStockColumn]);

 const selectedProduct = products.find(p => p.id === newSale.productId);
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
   <div className="flex flex-wrap items-center justify-between gap-3">
    {showModuleFilter ? (
     <Select value={moduleFilter} onValueChange={(value: ModuleFilter) => setModuleFilter(value)}>
      <SelectTrigger className="w-48 bg-white">
       <SelectValue />
      </SelectTrigger>
       <SelectContent>
        <SelectItem value="ALL">All Modules</SelectItem>
        <SelectItem value="FEED_MILL">Feed Mill</SelectItem>
        <SelectItem value="BSF">BSF</SelectItem>
        <SelectItem value="POULTRY">Poultry</SelectItem>
        <SelectItem value="CATFISH">Catfish</SelectItem>
       </SelectContent>
     </Select>
    ) : (
     <div />
    )}

    <div className="flex flex-wrap items-center gap-2">
     <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
      <DialogTrigger asChild>
       <Button variant="outline">New Product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-112.5">
       <DialogHeader>
        <DialogTitle className="text-xl font-bold tracking-tight">Create Product</DialogTitle>
       </DialogHeader>
       <form onSubmit={handleAddProduct} className="space-y-6 py-4">
        <div className="space-y-2">
         <Label htmlFor="productName">Product Name</Label>
         <Input
          id="productName"
          value={newProduct.name}
          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
          required
         />
        </div>
        <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label>Module</Label>
          <Select
           value={newProduct.module}
           onValueChange={(value: ModuleFilter) => setNewProduct({ ...newProduct, module: value })}
          >
           <SelectTrigger>
            <SelectValue />
           </SelectTrigger>
           <SelectContent>
            <SelectItem value="FEED_MILL">Feed Mill</SelectItem>
            <SelectItem value="BSF">BSF</SelectItem>
            <SelectItem value="POULTRY">Poultry</SelectItem>
            <SelectItem value="CATFISH">Catfish</SelectItem>
           </SelectContent>
          </Select>
         </div>
         <div className="space-y-2">
          <Label htmlFor="productUnit">Unit</Label>
          <Input
           id="productUnit"
           value={newProduct.unit}
           onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value.toUpperCase() })}
           placeholder="BAG, CRATE, BIRD, KG"
           required
          />
         </div>
        </div>
        <DialogFooter>
         <Button type="submit" disabled={creatingProduct} className="w-full">
          {creatingProduct ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Product
         </Button>
        </DialogFooter>
       </form>
      </DialogContent>
     </Dialog>

     <Dialog open={showAddSale} onOpenChange={setShowAddSale}>
      <DialogTrigger asChild>
       <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-6 mr-2">
        <Plus className="w-4 h-4 " />
        Log New Sale
       </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-112.5 max-h-[85vh] overflow-y-auto modal-scrollbar">
      <DialogHeader>
       <DialogTitle className="text-xl font-bold tracking-tight">Log New Sale</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleAddSale} className="space-y-6 py-4">
       <div className="space-y-2">
        <Label htmlFor="saleDate">Sale Date</Label>
        <Input
         id="saleDate"
         type="date"
         value={newSale.soldAt}
         onChange={(e) => setNewSale({ ...newSale, soldAt: e.target.value })}
         required
        />
       </div>

       <div className="space-y-2">
        <Label htmlFor="product">Product</Label>
       <Select value={newSale.productId} onValueChange={(val) => setNewSale({ ...newSale, productId: val })}>
         <SelectTrigger>
          <SelectValue placeholder="Choose product..." />
         </SelectTrigger>
         <SelectContent>
          {products.map(p => (
           <SelectItem key={p.id} value={p.id}>
            {p.name} {`(Stock: ${Number(p.quantityOnHand || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
           </SelectItem>
          ))}
         </SelectContent>
        </Select>
       </div>

       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
         <Label htmlFor="qty">Quantity {selectedProduct?.unit ? `(${selectedProduct.unit})` : ''}</Label>
         <Input
          id="qty"
          type="number"
          step="0.01"
          value={newSale.quantitySold}
          onChange={(e) => setNewSale({ ...newSale, quantitySold: e.target.value })}
          required
         />
         <p className="text-xs text-slate-500">
          Available: {selectedStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {selectedProduct?.unit || ''}
         </p>
        </div>
        <div className="space-y-2">
         <Label htmlFor="price">Unit Price (₦)</Label>
         <Input
          id="price"
          type="number"
          step="0.01"
          value={newSale.unitSellingPrice}
          onChange={(e) => setNewSale({ ...newSale, unitSellingPrice: e.target.value })}
          required
         />
        </div>
       </div>

       <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
         id="notes"
         value={newSale.notes}
         onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })}
        />
       </div>

       <DialogFooter>
        <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-base font-semibold transition-all">
         {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
         Finalize Sale
        </Button>
       </DialogFooter>
      </form>
     </DialogContent>
    </Dialog>
    </div>
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


