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
import { Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StockRow = {
  id: string;
  name: string;
  unit: string;
  unitSizeKg?: number | null;
  quantityOnHand: number;
  averageUnitCost: number;
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

export function FinishedFeedStockGrid() {
  const [rowData, setRowData] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockRow | null>(null);
  const [saleForm, setSaleForm] = useState({ quantityKg: '', unitPrice: '', targetModule: 'POULTRY' });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/location?code=FEED_MILL&module=FEED_MILL');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Finished feed stock load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.items || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const colDefs = useMemo<ColDef<StockRow>[]>(() => [
    {
      field: "name",
      headerName: "Feed",
      flex: 1.6,
      minWidth: 200,
      filter: true
    },
    {
      field: "unit",
      headerName: "Unit",
      width: 100
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
      headerName: "Avg Cost",
      flex: 1,
      type: 'numericColumn',
      valueGetter: (p: any) => Number(p.data.averageUnitCost || 0),
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      headerName: "Actions",
      width: 180,
      cellRenderer: (params: any) => (
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => {
            setSelectedProduct(params.data);
            setSaleForm({ quantityKg: '', unitPrice: '', targetModule: 'POULTRY' });
            setDialogOpen(true);
          }}
        >
          Internal Sale
        </Button>
      )
    }
  ], []);

  const handleInternalSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const quantityKg = Number(saleForm.quantityKg);
    const unitPrice = Number(saleForm.unitPrice);
    if (!quantityKg || quantityKg <= 0 || !unitPrice || unitPrice <= 0) {
      alert('Enter a valid quantity and price.');
      return;
    }

    setSelling(true);
    const response = await fetch('/api/finished-goods/internal-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedProduct.id,
        quantityKg,
        unitPrice,
        targetModule: saleForm.targetModule
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'Failed to record internal sale.');
    } else {
      setDialogOpen(false);
      setSelectedProduct(null);
      setSaleForm({ quantityKg: '', unitPrice: '', targetModule: 'POULTRY' });
      loadData();
      alert('Internal feed purchase recorded.');
    }
    setSelling(false);
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
          <DialogTitle>Internal Feed Sale</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleInternalSale} className="space-y-4">
            <div className="space-y-1 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{selectedProduct?.name}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantityKg">Quantity (kg)</Label>
              <Input
                id="quantityKg"
                type="number"
                step="0.01"
                value={saleForm.quantityKg}
                onChange={(e) => setSaleForm({ ...saleForm, quantityKg: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price (NGN / kg)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={saleForm.unitPrice}
                onChange={(e) => setSaleForm({ ...saleForm, unitPrice: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Target Module</Label>
              <Select
                value={saleForm.targetModule}
                onValueChange={(value) => setSaleForm({ ...saleForm, targetModule: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POULTRY">Poultry</SelectItem>
                  <SelectItem value="CATFISH">Catfish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={selling}>
                {selling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Internal Sale
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
