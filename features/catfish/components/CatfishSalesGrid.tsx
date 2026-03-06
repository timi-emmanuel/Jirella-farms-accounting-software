/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Loader2, Pencil, Plus } from 'lucide-react';
import { CatfishBatch, CatfishSale } from '@/types';
import { useUserRole } from '@/hooks/useUserRole';
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
  productionType?: 'Fingerlings' | 'Juvenile' | 'Grow-out (Adult)';
  stageLabel?: string;
};

export function CatfishSalesGrid({
  batchId,
  hideBatchColumn,
  productionType = 'Fingerlings',
  stageLabel = 'Fingerlings'
}: Props) {
  const { role } = useUserRole();
  const canViewFinancials = role !== 'CATFISH_STAFF';
  const [rowData, setRowData] = useState<any[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [pricingHint, setPricingHint] = useState<{ name: string; method: 'CM' | 'KG'; price: number } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [form, setForm] = useState({
    channel: 'EXTERNAL',
    batchId: batchId || '',
    pricingMethod: 'CM' as 'CM' | 'KG',
    saleDate: new Date().toISOString().split('T')[0],
    saleType: 'Partial Offload',
    quantitySold: '',
    unitPrice: '',
    saleLengthCm: '',
    saleWeightKg: '',
    buyerDetails: '',
    destinationBatchName: '',
    notes: ''
  });
  const [editForm, setEditForm] = useState({
    id: '',
    batchId: batchId || '',
    saleDate: new Date().toISOString().split('T')[0],
    saleType: 'Partial Offload',
    pricingMethod: 'CM' as 'CM' | 'KG',
    quantitySold: '',
    unitPrice: '',
    saleLengthCm: '',
    saleWeightKg: '',
    sizeCategoryName: '',
    buyerDetails: ''
  });

  const supportsLengthPricing =
    productionType === 'Fingerlings' ||
    productionType === 'Juvenile' ||
    productionType === 'Grow-out (Adult)';
  const internalSaleTargetStage = productionType === 'Juvenile' ? 'Grow-out (Adult)' : 'Juvenile';

  const loadData = async () => {
    setLoading(true);
    const query = batchId ? `?batchId=${batchId}` : '';
    const [salesRes, internalRes, batchesRes] = await Promise.all([
      fetch(`/api/catfish/sales${query}`),
      fetch(`/api/catfish/internal-sales${query}`),
      fetch(`/api/catfish/batches?productionType=${encodeURIComponent(productionType)}`)
    ]);

    const salesPayload = await salesRes.json().catch(() => ({}));
    const internalPayload = await internalRes.json().catch(() => ({}));
    const batchesPayload = await batchesRes.json().catch(() => ({}));

    if (salesRes.ok || internalRes.ok) {
      const externalRows = salesRes.ok ? (salesPayload.sales || []) : [];
      const internalRows = internalRes.ok
        ? (internalPayload.transfers || []).map((row: any) => ({
          id: `internal-${row.id}`,
          saleDate: row.transferDate,
          saleType: `Internal -> ${row.toStage}`,
          quantitySold: Number(row.quantity || 0),
          unitPrice: Number(row.costPerFishAtTransfer || 0),
          totalSaleValue: Number(row.transferCostBasis || 0),
          buyerDetails: row.notes || row.toBatch?.batchName || '-',
          batch: row.fromBatch ? { batchName: row.fromBatch.batchName } : null
        }))
        : [];
      const merged = [...externalRows, ...internalRows].sort((a: any, b: any) =>
        String(b.saleDate || '').localeCompare(String(a.saleDate || ''))
      );
      setRowData(merged);
    }
    if (batchesRes.ok) setBatches((batchesPayload.batches || []).filter((batch: any) => batch.status === 'Active'));

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [batchId, productionType]);

  useEffect(() => {
    const lookupPricing = async () => {
      if (!supportsLengthPricing || form.channel !== 'EXTERNAL') {
        setPricingHint(null);
        return;
      }

      setPricingLoading(true);
      const response = form.pricingMethod === 'CM'
        ? await fetch(`/api/catfish/settings/pricing?cm=${Number(form.saleLengthCm || 0)}`)
        : await fetch('/api/catfish/settings/pricing?basis=KG');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.row) {
        setPricingHint(null);
        setForm((prev) => ({ ...prev, unitPrice: '' }));
        setPricingLoading(false);
        return;
      }

      if (form.pricingMethod === 'CM') {
        const cm = Number(form.saleLengthCm || 0);
        if (!Number.isFinite(cm) || cm <= 0) {
          setPricingHint(null);
          setForm((prev) => ({ ...prev, unitPrice: '' }));
          setPricingLoading(false);
          return;
        }
        const nextPrice = Number(payload.row.price_per_piece || 0);
        setPricingHint({ name: String(payload.row.name || ''), method: 'CM', price: nextPrice });
        setForm((prev) => ({ ...prev, unitPrice: String(nextPrice) }));
      } else {
        const pricePerKg = Number(payload.row.price_per_kg || 0);
        const qty = Number(form.quantitySold || 0);
        const weight = Number(form.saleWeightKg || 0);
        const derivedUnitPrice = qty > 0 && weight > 0 ? (weight * pricePerKg) / qty : 0;
        setPricingHint({ name: String(payload.row.name || ''), method: 'KG', price: pricePerKg });
        setForm((prev) => ({ ...prev, unitPrice: derivedUnitPrice > 0 ? String(derivedUnitPrice) : '' }));
      }
      setPricingLoading(false);
    };

    lookupPricing();
  }, [form.saleLengthCm, form.saleWeightKg, form.quantitySold, form.pricingMethod, form.channel, supportsLengthPricing]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId || Number(form.quantitySold) <= 0) return;

    setSubmitting(true);
    const response = form.channel === 'INTERNAL'
      ? await fetch('/api/catfish/internal-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBatchId: form.batchId,
          targetStage: internalSaleTargetStage,
          transferDate: form.saleDate,
          quantity: Number(form.quantitySold),
          destinationBatchName: form.destinationBatchName || null,
          notes: form.notes || null
        })
      })
      : await fetch('/api/catfish/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: form.batchId,
          saleDate: form.saleDate,
          saleType: form.saleType,
          pricingMethod: form.pricingMethod,
          quantitySold: Number(form.quantitySold),
          unitPrice: Number(form.unitPrice),
          buyerDetails: form.buyerDetails || null,
          saleLengthCm: form.saleLengthCm ? Number(form.saleLengthCm) : null,
          saleWeightKg: form.saleWeightKg ? Number(form.saleWeightKg) : null
        })
      });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to record sale.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        channel: 'EXTERNAL',
        batchId: batchId || '',
        pricingMethod: 'CM',
        saleDate: new Date().toISOString().split('T')[0],
        saleType: 'Partial Offload',
        quantitySold: '',
        unitPrice: '',
        saleLengthCm: '',
        saleWeightKg: '',
        buyerDetails: '',
        destinationBatchName: '',
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const openEdit = useCallback((row: any) => {
    if (!row?.id || String(row.id).startsWith('internal-')) return;
    setEditForm({
      id: String(row.id),
      batchId: String(row.batchId || batchId || ''),
      saleDate: row.saleDate ? String(row.saleDate).split('T')[0] : new Date().toISOString().split('T')[0],
      saleType: row.saleType === 'Final Clear-Out' ? 'Final Clear-Out' : 'Partial Offload',
      pricingMethod: String(row.pricingMethod || 'CM').toUpperCase() === 'KG' ? 'KG' : 'CM',
      quantitySold: String(Number(row.quantitySold || 0)),
      unitPrice: String(Number(row.unitPrice || 0)),
      saleLengthCm: row.saleLengthCm === null || row.saleLengthCm === undefined ? '' : String(row.saleLengthCm),
      saleWeightKg: row.saleWeightKg === null || row.saleWeightKg === undefined ? '' : String(row.saleWeightKg),
      sizeCategoryName: String(row.sizeCategoryName || ''),
      buyerDetails: String(row.buyerDetails || '')
    });
    setEditingSaleId(String(row.id));
    setEditDialogOpen(true);
  }, [batchId]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSaleId) return;

    setEditSubmitting(true);
    const response = await fetch(`/api/catfish/sales?id=${editingSaleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: editForm.batchId,
        saleDate: editForm.saleDate,
        saleType: editForm.saleType,
        pricingMethod: editForm.pricingMethod,
        quantitySold: Number(editForm.quantitySold || 0),
        unitPrice: Number(editForm.unitPrice || 0),
        saleLengthCm: editForm.saleLengthCm ? Number(editForm.saleLengthCm) : null,
        saleWeightKg: editForm.saleWeightKg ? Number(editForm.saleWeightKg) : null,
        sizeCategoryName: editForm.sizeCategoryName || null,
        buyerDetails: editForm.buyerDetails || null
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
      toast({ title: "Success", description: "Sale updated.", variant: "success" });
      setEditDialogOpen(false);
      setEditingSaleId(null);
      loadData();
    }

    setEditSubmitting(false);
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
      { field: 'pricingMethod', headerName: 'Basis', minWidth: 90, valueFormatter: (p: any) => p.value || '-' },
      { field: 'saleLengthCm', headerName: 'Length (cm)', type: 'numericColumn', minWidth: 110, valueFormatter: (p: any) => p.value ? Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-' },
      { field: 'saleWeightKg', headerName: 'Weight (kg)', type: 'numericColumn', minWidth: 110, valueFormatter: (p: any) => p.value ? Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-' },
      { field: 'sizeCategoryName', headerName: 'Size Category', minWidth: 150, valueFormatter: (p: any) => p.value || '-' },
      { field: 'quantitySold', headerName: 'Qty Sold', type: 'numericColumn', minWidth: 110 },
      { field: 'buyerDetails', headerName: 'Buyer Details', minWidth: 200, flex: 1 },
      {
        headerName: 'Actions',
        minWidth: 120,
        maxWidth: 140,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          const row = p.data;
          const isInternal = String(row?.id || '').startsWith('internal-');
          if (isInternal) return <span className="text-slate-400 text-xs">-</span>;
          return (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500 hover:text-blue-600 hover:bg-transparent"
              onClick={() => openEdit(row)}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
          );
        }
      }
    );
    if (canViewFinancials) {
      cols.splice(-1, 0,
        {
          field: 'unitPrice',
          headerName: 'Unit Price (N)',
          type: 'numericColumn',
          minWidth: 130,
          valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        },
        {
          field: 'totalSaleValue',
          headerName: 'Total Value (N)',
          type: 'numericColumn',
          minWidth: 140,
          valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        }
      );
    }
    return cols;
  }, [hideBatchColumn, canViewFinancials, openEdit]);

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
              Log Sale / Internal Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-140 max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log {stageLabel} Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXTERNAL">Public Sale</SelectItem>
                      {(productionType === 'Fingerlings' || productionType === 'Juvenile') && (
                        <SelectItem value="INTERNAL">Internal Sale to {internalSaleTargetStage}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

              {form.channel === 'EXTERNAL' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  {supportsLengthPricing ? (
                    <div className="space-y-2">
                      <Label>Pricing Basis</Label>
                      <Select value={form.pricingMethod} onValueChange={(value: 'CM' | 'KG') => setForm({ ...form, pricingMethod: value, saleLengthCm: '', saleWeightKg: '', unitPrice: '' })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CM">By CM</SelectItem>
                          <SelectItem value="KG">By KG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {supportsLengthPricing && form.pricingMethod === 'CM' ? (
                    <div className="space-y-2">
                      <Label>Fish Length (cm)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.saleLengthCm}
                        onChange={(e) => setForm({ ...form, saleLengthCm: e.target.value })}
                        placeholder="Enter length"
                      />
                    </div>
                  ) : supportsLengthPricing && form.pricingMethod === 'KG' ? (
                    <div className="space-y-2">
                      <Label>Sale Weight (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.saleWeightKg}
                        onChange={(e) => setForm({ ...form, saleWeightKg: e.target.value })}
                        placeholder="Enter weight"
                      />
                    </div>
                  ) : null}
                  {!supportsLengthPricing ? (
                    <div />
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                  Destination stage: <span className="font-semibold">{internalSaleTargetStage}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{form.channel === 'INTERNAL' ? 'Quantity to Move' : 'Quantity Sold'}</Label>
                  <Input type="number" min="1" step="1" value={form.quantitySold} onChange={(e) => setForm({ ...form, quantitySold: e.target.value })} />
                </div>
                {form.channel === 'EXTERNAL' ? (
                  canViewFinancials ? (
                    <div className="space-y-2">
                      <Label>Unit Price (N)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unitPrice}
                        onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                        readOnly={supportsLengthPricing}
                      />
                    </div>
                  ) : (
                    <div />
                  )
                ) : (
                  <div className="space-y-2">
                    <Label>Destination Batch Name (optional)</Label>
                    <Input value={form.destinationBatchName} onChange={(e) => setForm({ ...form, destinationBatchName: e.target.value })} />
                  </div>
                )}
              </div>

              {form.channel === 'EXTERNAL' && supportsLengthPricing && canViewFinancials && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    {pricingLoading
                      ? 'Looking up price...'
                      : pricingHint
                        ? pricingHint.method === 'CM'
                          ? `Category: ${pricingHint.name} | Auto price: N ${pricingHint.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} per fish`
                          : `Category: ${pricingHint.name} | Price: N ${pricingHint.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} per kg`
                        : form.pricingMethod === 'CM'
                          ? 'No active pricing range matched this length.'
                          : 'No active KG pricing row found.'}
                  </p>
                </div>
              )}

              {form.channel === 'EXTERNAL' ? (
                <div className="space-y-2">
                  <Label>Buyer Details</Label>
                  <Textarea value={form.buyerDetails} onChange={(e) => setForm({ ...form, buyerDetails: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {form.channel === 'INTERNAL' ? 'Record Internal Sale' : 'Log Sale'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editDialogOpen}
          onOpenChange={(next) => {
            setEditDialogOpen(next);
            if (!next) setEditingSaleId(null);
          }}
        >
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Edit Sale</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              {!batchId && (
                <div className="space-y-2">
                  <Label>Batch</Label>
                  <Select value={editForm.batchId} onValueChange={(value) => setEditForm((prev) => ({ ...prev, batchId: value }))}>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editForm.saleDate} onChange={(e) => setEditForm((prev) => ({ ...prev, saleDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sale Type</Label>
                  <Select value={editForm.saleType} onValueChange={(value) => setEditForm((prev) => ({ ...prev, saleType: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Partial Offload">Partial Offload</SelectItem>
                      <SelectItem value="Final Clear-Out">Final Clear-Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Basis</Label>
                  <Select value={editForm.pricingMethod} onValueChange={(value: 'CM' | 'KG') => setEditForm((prev) => ({ ...prev, pricingMethod: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CM">By CM</SelectItem>
                      <SelectItem value="KG">By KG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Length (cm)</Label>
                  <Input type="number" min="0" step="0.01" value={editForm.saleLengthCm} onChange={(e) => setEditForm((prev) => ({ ...prev, saleLengthCm: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input type="number" min="0" step="0.01" value={editForm.saleWeightKg} onChange={(e) => setEditForm((prev) => ({ ...prev, saleWeightKg: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Quantity Sold</Label>
                  <Input type="number" min="1" step="1" value={editForm.quantitySold} onChange={(e) => setEditForm((prev) => ({ ...prev, quantitySold: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (N)</Label>
                  <Input type="number" min="0" step="0.01" value={editForm.unitPrice} onChange={(e) => setEditForm((prev) => ({ ...prev, unitPrice: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Size Category</Label>
                  <Input value={editForm.sizeCategoryName} onChange={(e) => setEditForm((prev) => ({ ...prev, sizeCategoryName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Buyer Details</Label>
                <Textarea value={editForm.buyerDetails} onChange={(e) => setEditForm((prev) => ({ ...prev, buyerDetails: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editSubmitting} className="w-full">
                  {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
            wrapHeaderText: true,
            autoHeaderHeight: true,
            minWidth: 140,
            }}
          overlayNoRowsTemplate="<span class='text-slate-500'>No sales found</span>"
          pagination={true}
          paginationPageSize={20}
        />
      </div>
    </div>
  );
}

