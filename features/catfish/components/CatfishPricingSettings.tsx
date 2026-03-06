/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ColDef,
  ModuleRegistry,
  ClientSideRowModelModule,
  ValidationModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  themeQuartz
} from 'ag-grid-community';
import { Loader2, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  PaginationModule,
  TextFilterModule,
  NumberFilterModule
]);

type PricingRow = {
  id: string;
  name: string;
  pricing_method: 'CM' | 'KG';
  min_cm: number;
  max_cm: number;
  price_per_piece?: number | null;
  price_per_kg?: number | null;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  name: string;
  pricingMethod: 'CM' | 'KG';
  minCm: string;
  maxCm: string;
  pricePerPiece: string;
  pricePerKg: string;
};

const emptyForm: FormState = {
  name: '',
  pricingMethod: 'CM',
  minCm: '',
  maxCm: '',
  pricePerPiece: '',
  pricePerKg: ''
};

export function CatfishPricingSettings() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Number(a.min_cm) - Number(b.min_cm)),
    [rows]
  );

  const formatRange = (row: PricingRow) => {
    if (row.pricing_method === 'KG') return '-';
    const min = Number(row.min_cm).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const max = Number(row.max_cm || 0);
    if (max >= 9999) return `${min}+`;
    return `${min} - ${max.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const colDefs: ColDef<PricingRow>[] = [
    { field: 'name', headerName: 'Category Name', minWidth: 190, flex: 1.2 },
    { field: 'pricing_method', headerName: 'Basis', minWidth: 95 },
    {
      headerName: 'CM Range',
      minWidth: 145,
      valueGetter: (params) => (params.data ? (params.data.pricing_method === 'CM' ? formatRange(params.data) : '-') : '-')
    },
    {
      headerName: 'Price',
      minWidth: 140,
      valueGetter: (params) => {
        const row = params.data;
        if (!row) return '';
        const amount = Number(row.pricing_method === 'CM' ? row.price_per_piece : row.price_per_kg || 0);
        return `N ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      }
    },
    {
      headerName: 'Status',
      minWidth: 110,
      valueGetter: (params) => (params.data?.is_active ? 'Active' : 'Inactive')
    },
    {
      headerName: 'Actions',
      minWidth: 210,
      sortable: false,
      filter: false,
      cellRenderer: (params: { data?: PricingRow }) => {
        const row = params.data;
        if (!row) return null;
        const isUpdating = updatingId === row.id;
        return (
          <div className="flex items-center gap-2 h-full">
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)} disabled={isUpdating}>
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleActive(row)}
              disabled={isUpdating}
              className={row.is_active ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : row.is_active ? (
                <>
                  <PowerOff className="w-4 h-4 mr-1" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 mr-1" />
                  Activate
                </>
              )}
            </Button>
          </div>
        );
      }
    }
  ];

  const loadRows = async () => {
    setLoading(true);
    const response = await fetch('/api/catfish/settings/pricing');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({
        title: 'Error',
        description: payload.error || 'Failed to load pricing settings.',
        variant: 'destructive'
      });
      setRows([]);
    } else {
      setRows(payload.rows || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: PricingRow) => {
    setEditing(row);
    setForm({
      name: row.name || '',
      pricingMethod: row.pricing_method || 'CM',
      minCm: String(row.min_cm ?? ''),
      maxCm: String(row.max_cm ?? ''),
      pricePerPiece: String(row.price_per_piece ?? ''),
      pricePerKg: String(row.price_per_kg ?? '')
    });
    setDialogOpen(true);
  };

  const validateClient = () => {
    const name = form.name.trim();
    const method = form.pricingMethod;

    if (!name) return 'Category name is required.';
    if (method === 'CM') {
      const minCm = Number(form.minCm);
      const maxCm = Number(form.maxCm);
      const price = Number(form.pricePerPiece);
      if (!Number.isFinite(minCm) || !Number.isFinite(maxCm)) return 'Min CM and Max CM are required.';
      if (minCm >= maxCm) return 'Min CM must be less than Max CM.';
      if (!Number.isFinite(price) || price <= 0) return 'Price per piece must be greater than zero.';
    } else {
      const priceKg = Number(form.pricePerKg);
      if (!Number.isFinite(priceKg) || priceKg <= 0) return 'Price per kg must be greater than zero.';
    }
    return null;
  };

  const savePricing = async (event: React.FormEvent) => {
    event.preventDefault();
    const clientError = validateClient();
    if (clientError) {
      toast({ title: 'Error', description: clientError, variant: 'destructive' });
      return;
    }

    setSaving(true);
    const pricingMethod = form.pricingMethod;
    const payload = {
      name: form.name.trim(),
      pricing_method: pricingMethod,
      min_cm: pricingMethod === 'CM' ? Number(form.minCm) : 0,
      max_cm: pricingMethod === 'CM' ? Number(form.maxCm) : 9999,
      price_per_piece: pricingMethod === 'CM' ? Number(form.pricePerPiece) : null,
      price_per_kg: pricingMethod === 'KG' ? Number(form.pricePerKg) : null
    };

    const url = editing
      ? `/api/catfish/settings/pricing?id=${editing.id}`
      : '/api/catfish/settings/pricing';
    const method = editing ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast({
        title: 'Error',
        description: body.error || 'Failed to save pricing settings.',
        variant: 'destructive'
      });
      setSaving(false);
      return;
    }

    toast({
      title: 'Saved',
      description: editing ? 'Pricing range updated.' : 'Pricing range created.',
      variant: 'success'
    });
    setDialogOpen(false);
    setForm(emptyForm);
    setEditing(null);
    setSaving(false);
    await loadRows();
  };

  const toggleActive = async (row: PricingRow) => {
    const nextActive = !row.is_active;
    if (!nextActive) {
      const ok = confirm(`Deactivate "${row.name}"?`);
      if (!ok) return;
    }

    setUpdatingId(row.id);
    const response = await fetch(`/api/catfish/settings/pricing?id=${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: nextActive })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast({
        title: 'Error',
        description: payload.error || 'Failed to update status.',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Updated',
        description: nextActive ? 'Range activated.' : 'Range deactivated.',
        variant: 'success'
      });
      await loadRows();
    }
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={dialogOpen}
          onOpenChange={(next) => {
            setDialogOpen(next);
            if (!next) {
              setEditing(null);
              setForm(emptyForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="w-4 h-4" />
              Add Pricing Range
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-135">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Pricing Range' : 'Create Pricing Range'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={savePricing} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Juveniles"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Pricing Basis</Label>
                <Select value={form.pricingMethod} onValueChange={(value: 'CM' | 'KG') => setForm((prev) => ({ ...prev, pricingMethod: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CM">By Length (CM)</SelectItem>
                    <SelectItem value="KG">By Weight (KG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.pricingMethod === 'CM' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minCm">Min CM</Label>
                      <Input
                        id="minCm"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.minCm}
                        onChange={(e) => setForm((prev) => ({ ...prev, minCm: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxCm">Max CM</Label>
                      <Input
                        id="maxCm"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.maxCm}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxCm: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricePerPiece">Price Per Piece (N)</Label>
                    <Input
                      id="pricePerPiece"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.pricePerPiece}
                      onChange={(e) => setForm((prev) => ({ ...prev, pricePerPiece: e.target.value }))}
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="pricePerKg">Price Per Kg (N)</Label>
                  <Input
                    id="pricePerKg"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.pricePerKg}
                    onChange={(e) => setForm((prev) => ({ ...prev, pricePerKg: e.target.value }))}
                    required
                  />
                </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editing ? 'Save Changes' : 'Save Range'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="md:hidden space-y-3">
        {sortedRows.length === 0 ? (
          <div className="rounded-2xl border bg-white px-4 py-10 text-center text-sm text-slate-500">
            No pricing ranges found.
          </div>
        ) : (
          sortedRows.map((row) => {
            const isUpdating = updatingId === row.id;
            return (
              <div key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <span
                    className={
                      row.is_active
                        ? 'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                        : 'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700'
                    }
                  >
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  <p><span className="text-slate-500">Basis:</span> {row.pricing_method}</p>
                  {row.pricing_method === 'CM' ? (
                    <>
                      <p><span className="text-slate-500">CM Range:</span> {formatRange(row)} cm</p>
                      <p><span className="text-slate-500">Price / Piece:</span> N {Number(row.price_per_piece || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </>
                  ) : (
                    <p><span className="text-slate-500">Price / Kg:</span> N {Number(row.price_per_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(row)} disabled={isUpdating}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(row)}
                    disabled={isUpdating}
                    className={row.is_active ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}
                  >
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : row.is_active ? (
                      <>
                        <PowerOff className="w-4 h-4 mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden md:block rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="h-100">
          <AgGridReact
            theme={themeQuartz}
            rowData={sortedRows}
            columnDefs={colDefs}
            suppressMovableColumns={typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches}
            defaultColDef={{
              sortable: true,
              filter: true,
              wrapHeaderText: true,
              autoHeaderHeight: true,
              minWidth: 120,
            }}
            pagination={true}
            paginationPageSize={15}
            overlayNoRowsTemplate="<span class='text-slate-500'>No pricing ranges found</span>"
          />
        </div>
      </div>
    </div>
  );
}
