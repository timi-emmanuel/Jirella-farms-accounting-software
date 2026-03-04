/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from 'react';
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

type PricingRow = {
  id: string;
  name: string;
  min_cm: number;
  max_cm: number;
  price_per_piece: number;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  name: string;
  minCm: string;
  maxCm: string;
  pricePerPiece: string;
};

const emptyForm: FormState = {
  name: '',
  minCm: '',
  maxCm: '',
  pricePerPiece: ''
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
      minCm: String(row.min_cm ?? ''),
      maxCm: String(row.max_cm ?? ''),
      pricePerPiece: String(row.price_per_piece ?? '')
    });
    setDialogOpen(true);
  };

  const validateClient = () => {
    const name = form.name.trim();
    const minCm = Number(form.minCm);
    const maxCm = Number(form.maxCm);
    const price = Number(form.pricePerPiece);

    if (!name) return 'Category name is required.';
    if (!Number.isFinite(minCm) || !Number.isFinite(maxCm)) return 'Min CM and Max CM are required.';
    if (minCm >= maxCm) return 'Min CM must be less than Max CM.';
    if (!Number.isFinite(price) || price <= 0) return 'Price per piece must be greater than zero.';
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
    const payload = {
      name: form.name.trim(),
      min_cm: Number(form.minCm),
      max_cm: Number(form.maxCm),
      price_per_piece: Number(form.pricePerPiece)
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
          <DialogContent className="sm:max-w-[540px]">
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

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-3 text-xs uppercase tracking-widest font-semibold text-slate-500">
          <div className="col-span-3">Category Name</div>
          <div className="col-span-2">CM Range</div>
          <div className="col-span-2">Price / Piece</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        {sortedRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            No pricing ranges found.
          </div>
        ) : (
          sortedRows.map((row) => {
            const isUpdating = updatingId === row.id;
            return (
              <div key={row.id} className="grid grid-cols-12 gap-2 border-b last:border-b-0 px-4 py-4 items-center text-sm">
                <div className="col-span-3 font-semibold text-slate-900">{row.name}</div>
                <div className="col-span-2 text-slate-700">
                  {Number(row.min_cm).toLocaleString(undefined, { maximumFractionDigits: 2 })} - {Number(row.max_cm).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="col-span-2 text-slate-700">
                  N {Number(row.price_per_piece).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="col-span-2">
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
                <div className="col-span-3 flex justify-end gap-2">
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
