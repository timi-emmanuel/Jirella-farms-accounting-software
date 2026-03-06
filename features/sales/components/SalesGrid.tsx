"use client"

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Loader2, Pencil, Plus, TrendingUp } from 'lucide-react';
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
  showStockColumn = true,
  productFilter,
  headerActionsRight,
  hideCogsColumn = false,
  hideGrossProfitColumn = false
}: {
  initialModule?: ModuleFilter;
  showModuleFilter?: boolean;
  showStockColumn?: boolean;
  productFilter?: (product: Product & { quantityOnHand?: number; averageUnitCost?: number }) => boolean;
  headerActionsRight?: ReactNode;
  hideCogsColumn?: boolean;
  hideGrossProfitColumn?: boolean;
}) {
 const [rowData, setRowData] = useState<Sale[]>([]);
 const [products, setProducts] = useState<(Product & { quantityOnHand?: number; averageUnitCost?: number })[]>([]);
 const [loading, setLoading] = useState(true);
 const [showAddSale, setShowAddSale] = useState(false);
 const [showAddProduct, setShowAddProduct] = useState(false);
 const [showEditSale, setShowEditSale] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [creatingProduct, setCreatingProduct] = useState(false);
 const [updatingSale, setUpdatingSale] = useState(false);
 const [undoingSaleId, setUndoingSaleId] = useState<string | null>(null);
 const [moduleFilter, setModuleFilter] = useState<ModuleFilter>(initialModule);

 const [newSale, setNewSale] = useState({
  productId: '',
  quantitySold: '',
  unitSellingPrice: '',
  soldAt: new Date().toISOString().split('T')[0],
  notes: '',
  customerName: '',
  customerContact: '',
  customerAddress: ''
 });

 const [newProduct, setNewProduct] = useState({
  name: '',
  module: 'FEED_MILL' as ModuleFilter,
  unit: ''
 });
 const [editSale, setEditSale] = useState({
  id: '',
  soldAt: new Date().toISOString().split('T')[0],
  unitSellingPrice: '',
  notes: '',
  customerName: '',
  customerContact: '',
  customerAddress: ''
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
   const list = payload.products || [];
   setProducts(productFilter ? list.filter(productFilter) : list);
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
  if (!newSale.customerName.trim()) {
   toast({ title: "Missing customer", description: "Customer name is required for external sales.", variant: "destructive" });
   return;
  }
  const contactDigits = newSale.customerContact.replace(/\D/g, '');
  if (contactDigits && !/^\d{11}$/.test(contactDigits)) {
   toast({ title: "Invalid contact", description: "Contact must be an 11 digit number.", variant: "destructive" });
   return;
  }
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
    notes: newSale.notes,
    customerName: newSale.customerName,
    customerContact: contactDigits || null,
    customerAddress: newSale.customerAddress || null
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
    notes: '',
    customerName: '',
    customerContact: '',
   customerAddress: ''
   });
   loadSales(moduleFilter);
   loadProducts(moduleFilter);
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

 const openEditSale = (sale: Sale) => {
  setEditSale({
   id: sale.id,
   soldAt: sale.soldAt ? String(sale.soldAt).split('T')[0] : new Date().toISOString().split('T')[0],
   unitSellingPrice: String(Number(sale.unitSellingPrice || 0)),
   notes: sale.notes || '',
   customerName: sale.customerName || '',
   customerContact: sale.customerContact || '',
   customerAddress: sale.customerAddress || ''
  });
  setShowEditSale(true);
 };

 const handleEditSale = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editSale.id) return;
  if (!editSale.customerName.trim()) {
   toast({ title: "Missing customer", description: "Customer name is required.", variant: "destructive" });
   return;
  }
  const contactDigits = editSale.customerContact.replace(/\D/g, '');
  if (contactDigits && !/^\d{11}$/.test(contactDigits)) {
   toast({ title: "Invalid contact", description: "Contact must be an 11 digit number.", variant: "destructive" });
   return;
  }

  setUpdatingSale(true);
  const response = await fetch(`/api/sales?id=${editSale.id}`, {
   method: 'PATCH',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({
    soldAt: editSale.soldAt,
    unitSellingPrice: Number(editSale.unitSellingPrice || 0),
    notes: editSale.notes || null,
    customerName: editSale.customerName.trim(),
    customerContact: contactDigits || null,
    customerAddress: editSale.customerAddress || null
   })
  });

  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to update sale.',
    variant: "destructive"
   });
  } else {
   setShowEditSale(false);
   loadSales(moduleFilter);
  }
  setUpdatingSale(false);
 };

 const handleUndoSale = async (sale: Sale) => {
  if (!sale?.id) return;
  if (sale.module !== 'FEED_MILL') {
   toast({
    title: "Not allowed",
    description: "Undo sale is currently supported for Feed Mill sales only.",
    variant: "destructive"
   });
   return;
  }

  const confirmed = window.confirm(
   `Undo this sale for "${sale.product?.name || 'product'}"? This will return the quantity to finished stock.`
  );
  if (!confirmed) return;

  setUndoingSaleId(sale.id);
  const response = await fetch(`/api/sales?id=${sale.id}`, { method: 'DELETE' });
  if (!response.ok) {
   const payload = await response.json().catch(() => ({}));
   toast({
    title: "Error",
    description: payload.error || 'Failed to undo sale.',
    variant: "destructive"
   });
  } else {
   toast({
    title: "Sale undone",
    description: "Sale was reversed and stock has been restored."
   });
   loadSales(moduleFilter);
   loadProducts(moduleFilter);
  }
  setUndoingSaleId(null);
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
   minWidth: 120,
   valueFormatter: (p: any) => {
     if (!p.value) return '';
     const formatted = new Date(p.value).toLocaleDateString('en-GB');
     return formatted.replace(/\//g, '-');
   }
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
   headerName: "Customer Name",
   flex: 1.4,
   minWidth: 160,
   valueGetter: (p: any) => {
    const saleType = p.data.saleType ?? 'EXTERNAL';
    if (saleType !== 'EXTERNAL') return '-';
    return p.data.customerName || '-';
   }
  },
  {
   headerName: "Contact",
   flex: 1.2,
   minWidth: 140,
   valueGetter: (p: any) => {
    const saleType = p.data.saleType ?? 'EXTERNAL';
    if (saleType !== 'EXTERNAL') return '-';
    return p.data.customerContact || '-';
   }
  },
  {
   headerName: "Address",
   flex: 1.6,
   minWidth: 180,
   valueGetter: (p: any) => {
    const saleType = p.data.saleType ?? 'EXTERNAL';
    if (saleType !== 'EXTERNAL') return '-';
    return p.data.customerAddress || '-';
   }
  },
  {
   field: "quantitySold",
   headerName: "Quantity",
   type: 'numericColumn',
   filter: false,
   flex: 1,
   minWidth: 160,
   valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  {
   field: "unitSellingPrice",
   headerName: "Unit Price (₦)",
   type: 'numericColumn',
   flex: 1,
   minWidth: 160,
   filter: false,
   valueFormatter: (p: any) => `${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  },
  {
   headerName: "Revenue",
   type: 'numericColumn',
   filter: false,
   flex: 1,
   minWidth: 160,
   valueGetter: (p: any) => Number(p.data.quantitySold) * Number(p.data.unitSellingPrice),
   valueFormatter: (p: any) => ` ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  },
  ...(hideCogsColumn
    ? []
    : [{
      headerName: "COGS",
      type: 'numericColumn',
      filter: false,
      flex: 1,
      minWidth: 160,
      valueGetter: (p: any) => Number(p.data.quantitySold) * Number(p.data.unitCostAtSale || 0),
      valueFormatter: (p: any) => ` ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    }]),
  ...(hideGrossProfitColumn
    ? []
    : [{
      headerName: "Gross Profit (₦)",
      type: 'numericColumn',
      filter: false,
      flex: 1,
      minWidth: 180,
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
    }])
  ,
  {
   headerName: "Actions",
   minWidth: 180,
   maxWidth: 190,
   pinned: 'right',
   lockPinned: true,
   sortable: false,
   filter: false,
   cellRenderer: (p: any) => {
    const sale = p.data as Sale;
    const isUndoing = undoingSaleId === sale.id;
    const canUndo = sale.module === 'FEED_MILL';

    return (
      <div className="flex w-full items-center justify-center gap-1">
       <Button
        size="sm"
        variant="ghost"
        className="h-8 px-1.5 text-slate-500 hover:text-blue-600 hover:bg-transparent"
        onClick={() => openEditSale(sale)}
       >
        <Pencil className="w-4 h-4 mr-1" />
        Edit
       </Button>
       <Button
        size="sm"
        variant="ghost"
        disabled={!canUndo || isUndoing}
        className="h-8 px-1.5 text-rose-600 hover:text-rose-700 hover:bg-transparent disabled:text-slate-300"
        onClick={() => handleUndoSale(sale)}
       >
        {isUndoing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Undo
       </Button>
      </div>
    );
   }
  }
  ];

  if (showStockColumn) {
    columns.splice(3, 0, {
      headerName: "Current Stock",
      type: 'numericColumn',
      flex: 1,
      minWidth: 160,
      filter: false,
      valueGetter: (p: any) => {
        const product = stockByProductId.get(p.data.productId);
        return Number(product?.quantityOnHand || 0);
      },
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    });
  }

  return columns;
 }, [stockByProductId, showStockColumn, hideCogsColumn, hideGrossProfitColumn, undoingSaleId, handleUndoSale]);

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
  <div className="flex flex-col h-full space-y-4 sales-grid">
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

    <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
     <div className="flex items-center gap-2">
      {headerActionsRight}
     </div>
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
       <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6 mr-2">
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

       <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Customer Details</p>
        <div className="grid grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name</Label>
          <Input
           id="customerName"
           value={newSale.customerName}
           onChange={(e) => setNewSale({ ...newSale, customerName: e.target.value })}
           required
          />
         </div>
        <div className="space-y-2">
          <Label htmlFor="customerContact">Contact</Label>
          <Input
           id="customerContact"
           value={newSale.customerContact}
           inputMode="numeric"
           maxLength={11}
           placeholder="11-digit number"
           onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, 11);
            setNewSale({ ...newSale, customerContact: next });
           }}
          />
         </div>
        </div>
        <div className="space-y-2">
         <Label htmlFor="customerAddress">Address</Label>
         <Input
          id="customerAddress"
          value={newSale.customerAddress}
          onChange={(e) => setNewSale({ ...newSale, customerAddress: e.target.value })}
         />
        </div>
       </div>

       <DialogFooter>
        <Button type="submit" disabled={submitting} className="w-full bg-emerald-700 hover:bg-emerald-800 py-6 text-base font-semibold transition-all">
         {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
         Finalize Sale
        </Button>
       </DialogFooter>
      </form>
    </DialogContent>
   </Dialog>

   <Dialog open={showEditSale} onOpenChange={setShowEditSale}>
    <DialogContent className="sm:max-w-112.5">
     <DialogHeader>
      <DialogTitle className="text-xl font-bold tracking-tight">Edit Sale</DialogTitle>
     </DialogHeader>
     <form onSubmit={handleEditSale} className="space-y-4 py-2">
      <div className="space-y-2">
       <Label htmlFor="editSaleDate">Sale Date</Label>
       <Input id="editSaleDate" type="date" value={editSale.soldAt} onChange={(e) => setEditSale({ ...editSale, soldAt: e.target.value })} required />
      </div>
      <div className="space-y-2">
       <Label htmlFor="editUnitPrice">Unit Price (N)</Label>
       <Input id="editUnitPrice" type="number" min="0" step="0.01" value={editSale.unitSellingPrice} onChange={(e) => setEditSale({ ...editSale, unitSellingPrice: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
       <div className="space-y-2">
        <Label htmlFor="editCustomerName">Customer Name</Label>
        <Input id="editCustomerName" value={editSale.customerName} onChange={(e) => setEditSale({ ...editSale, customerName: e.target.value })} required />
       </div>
       <div className="space-y-2">
        <Label htmlFor="editCustomerContact">Contact</Label>
        <Input
         id="editCustomerContact"
         value={editSale.customerContact}
         inputMode="numeric"
         maxLength={11}
         placeholder="11-digit number"
         onChange={(e) => setEditSale({ ...editSale, customerContact: e.target.value.replace(/\D/g, '').slice(0, 11) })}
        />
       </div>
      </div>
      <div className="space-y-2">
       <Label htmlFor="editCustomerAddress">Address</Label>
       <Input id="editCustomerAddress" value={editSale.customerAddress} onChange={(e) => setEditSale({ ...editSale, customerAddress: e.target.value })} />
      </div>
      <div className="space-y-2">
       <Label htmlFor="editNotes">Notes</Label>
       <Input id="editNotes" value={editSale.notes} onChange={(e) => setEditSale({ ...editSale, notes: e.target.value })} />
      </div>
      <DialogFooter>
       <Button type="submit" disabled={updatingSale} className="w-full">
        {updatingSale ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Save Changes
       </Button>
      </DialogFooter>
     </form>
    </DialogContent>
   </Dialog>
     </div>
    </div>
   </div>

   <div className="flex-1 border rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/50">
    <AgGridReact
          suppressMovableColumns={typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches}
theme={themeQuartz}
     rowData={rowData}
     columnDefs={colDefs}
     defaultColDef={{
      sortable: true,
      filter: true,
      wrapHeaderText: false,
      autoHeaderHeight: false,
      minWidth: 140,
     }}
     pagination={true}
     paginationPageSize={20}
    />
   </div>
  </div>
 );
}






