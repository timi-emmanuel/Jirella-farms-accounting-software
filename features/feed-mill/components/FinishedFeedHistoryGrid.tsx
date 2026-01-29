"use client";

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ColDef,
  ModuleRegistry,
  CellStyleModule,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FeedProduct = {
  id: string;
  name: string;
};

type HistoryRow = {
  id: string;
  type: string;
  quantity: number;
  unitCostAtTime?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdByProfile?: { email?: string | null; role?: string | null } | null;
  createdAt: string;
};

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CellStyleModule,
  ValidationModule,
  PaginationModule,
  RowStyleModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule
]);

const typeLabels: Record<string, string> = {
  PRODUCTION_IN: 'PRODUCED',
  TRANSFER_OUT: 'TRANSFERRED_TO_POULTRY',
  SALE_OUT: 'SOLD',
  TRANSFER_IN: 'TRANSFERRED_IN',
  INTERNAL_SALE_OUT: 'INTERNAL_SALE_TO_POULTRY',
  INTERNAL_PURCHASE_IN: 'INTERNAL_PURCHASE_IN',
  USAGE: 'USED',
  ADJUSTMENT: 'ADJUSTMENT'
};

export function FinishedFeedHistoryGrid() {
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    const response = await fetch('/api/finished-goods/location?code=FEED_MILL&module=FEED_MILL');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Finished feed products load error:', payload.error || response.statusText);
      setProducts([]);
    } else {
      const items = payload.items || [];
      setProducts(items.map((item: any) => ({ id: item.id, name: item.name })));
      if (items.length > 0 && !selectedProductId) {
        setSelectedProductId(items[0].id);
      }
    }
    setLoading(false);
  };

  const loadHistory = async (productId: string) => {
    setHistoryLoading(true);
    const response = await fetch(`/api/finished-goods/history?productId=${productId}&locationCode=FEED_MILL`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Finished feed history load error:', payload.error || response.statusText);
      setHistory([]);
    } else {
      setHistory(payload.history || []);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadHistory(selectedProductId);
    }
  }, [selectedProductId]);

  const historyDefs = useMemo<ColDef<HistoryRow>[]>(() => [
    {
      field: "createdAt",
      headerName: "Date",
      minWidth: 160,
      valueFormatter: (p: any) => {
        const parsed = new Date(p.value);
        const datePart = parsed.toLocaleDateString('en-GB').replace(/\//g, '-');
        return `${datePart} ${parsed.toLocaleTimeString()}`;
      }
    },
    {
      field: "type",
      headerName: "Action",
      minWidth: 180,
      valueGetter: (p: any) => typeLabels[p.data.type] || p.data.type
    },
    {
      field: "quantity",
      headerName: "Qty",
      type: 'numericColumn',
      minWidth: 110,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: "unitCostAtTime",
      headerName: "Unit Cost (₦)",
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      headerName: "Reference",
      flex: 1,
      minWidth: 180,
      valueGetter: (p: any) => p.data.referenceId || ''
    },
    {
      headerName: "By",
      flex: 1,
      minWidth: 140,
      valueGetter: (p: any) => p.data.createdByProfile?.role || ''
    }
  ], []);

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm  text-slate-700">Finished Feed Movement History</span>
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="w-72 bg-white">
            <SelectValue placeholder="Select feed product" />
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

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        {historyLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="h-105 ag-theme-quartz">
            <AgGridReact
              rowData={history}
              columnDefs={historyDefs}
              defaultColDef={{
                sortable: true,
                resizable: true,
              }}
              pagination={true}
              paginationPageSize={15}
              paginationPageSizeSelector={[15, 30, 50]}
              theme={themeQuartz}
            />
          </div>
        )}
      </div>
    </div>
  );
}

