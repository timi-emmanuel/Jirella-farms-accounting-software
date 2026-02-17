"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { BsfLarvariumBatch } from '@/types';
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
import { Textarea } from '@/components/ui/textarea';
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

export function BsfLarvariumBatchGrid() {
  const [rowData, setRowData] = useState<BsfLarvariumBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    batchCode: '',
    startDate: new Date().toISOString().split('T')[0],
    eggsGramsUsed: '',
    initialLarvaeWeightGrams: '',
    substrateMixRatio: '',
    status: 'GROWING',
    notes: ''
  });
  const [editForm, setEditForm] = useState({
    id: '',
    batchCode: '',
    startDate: new Date().toISOString().split('T')[0],
    initialLarvaeWeightGrams: '',
    substrateMixRatio: '',
    status: 'GROWING',
    harvestDate: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/bsf/larvarium/batches');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('BSF batch load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.batches || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchCode) return;

    setSubmitting(true);
    const response = await fetch('/api/bsf/larvarium/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        eggsGramsUsed: Number(form.eggsGramsUsed || 0),
        initialLarvaeWeightGrams: Number(form.initialLarvaeWeightGrams || 0)
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to create batch.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        batchCode: '',
        startDate: new Date().toISOString().split('T')[0],
        eggsGramsUsed: '',
        initialLarvaeWeightGrams: '',
        substrateMixRatio: '',
        status: 'GROWING',
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const handleDelete = async (batch: BsfLarvariumBatch) => {
    if (!confirm(`Delete batch "${batch.batchCode}"? This cannot be undone.`)) return;
    setDeletingId(batch.id);
    const response = await fetch(`/api/bsf/larvarium/batches?id=${batch.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to delete batch.',
        variant: "destructive"
      });
    } else {
      loadData();
    }
    setDeletingId(null);
  };

  const openEdit = (batch: BsfLarvariumBatch) => {
    setEditForm({
      id: batch.id,
      batchCode: batch.batchCode ?? '',
      startDate: batch.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      initialLarvaeWeightGrams: String(batch.initialLarvaeWeightGrams ?? ''),
      substrateMixRatio: batch.substrateMixRatio ?? '',
      status: batch.status ?? 'GROWING',
      harvestDate: batch.harvestDate ? new Date(batch.harvestDate).toISOString().split('T')[0] : '',
      notes: batch.notes ?? ''
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id || !editForm.batchCode) return;

    setEditingId(editForm.id);
    const response = await fetch(`/api/bsf/larvarium/batches?id=${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchCode: editForm.batchCode,
        startDate: editForm.startDate,
        initialLarvaeWeightGrams: Number(editForm.initialLarvaeWeightGrams || 0),
        substrateMixRatio: editForm.substrateMixRatio,
        status: editForm.status,
        harvestDate: editForm.harvestDate || null,
        notes: editForm.notes
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to update batch.',
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Batch updated successfully.",
        variant: "success"
      });
      setEditDialogOpen(false);
      loadData();
    }
    setEditingId(null);
  };

  const colDefs = useMemo<ColDef<BsfLarvariumBatch>[]>(() => [
    {
      headerName: 'Batch Code',
      minWidth: 160,
      field: 'batchCode',
      cellRenderer: (params: any) => (
        <Link className="text-emerald-700 font-semibold" href={`/bsf/larvarium/batches/${params.data.id}`}>
          {params.value}
        </Link>
      )
    },
    { field: 'startDate', headerName: 'Start Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') },
    { field: 'eggsGramsUsed', headerName: 'Eggs Used (g)', type: 'numericColumn', minWidth: 140 },
    {
      field: 'initialLarvaeWeightGrams',
      headerName: 'Initial (g)',
      type: 'numericColumn',
      minWidth: 120
    },
    { field: 'status', headerName: 'Status', minWidth: 120 },
    { field: 'harvestDate', headerName: 'Harvest Date', minWidth: 120, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') : '' },
    { field: 'substrateMixRatio', headerName: 'Mix Ratio', flex: 1.2, minWidth: 180 },
    { field: 'notes', headerName: 'Notes', flex: 1.4, minWidth: 200 },
    {
      headerName: "Actions",
      width: 160,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const batch = params.data as BsfLarvariumBatch;
        const isDeleting = deletingId === batch.id;
        const isEditing = editingId === batch.id;
        return (
          <div className="flex items-center justify-center h-full w-full gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500 hover:text-blue-600 hover:bg-transparent"
              disabled={isDeleting || isEditing}
              onClick={() => openEdit(batch)}
            >
              {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500 hover:text-rose-600 hover:bg-transparent"
              disabled={isDeleting || isEditing}
              onClick={() => handleDelete(batch)}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        );
      }
    }
  ], [deletingId, editingId]);

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
              New Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Create Larvarium Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batchCode">Batch Code</Label>
                  <Input
                    id="batchCode"
                    value={form.batchCode}
                    onChange={(e) => setForm({ ...form, batchCode: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial">Initial Larvae (g)</Label>
                  <Input
                    id="initial"
                    type="number"
                    step="0.01"
                    value={form.initialLarvaeWeightGrams}
                    onChange={(e) => setForm({ ...form, initialLarvaeWeightGrams: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eggsUsed">Eggs Used (g)</Label>
                  <Input
                    id="eggsUsed"
                    type="number"
                    step="0.01"
                    value={form.eggsGramsUsed}
                    onChange={(e) => setForm({ ...form, eggsGramsUsed: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GROWING">Growing</SelectItem>
                      <SelectItem value="HARVESTED">Harvested</SelectItem>
                      <SelectItem value="PROCESSED">Processed</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mix">Substrate Mix Ratio</Label>
                <Input
                  id="mix"
                  value={form.substrateMixRatio}
                  onChange={(e) => setForm({ ...form, substrateMixRatio: e.target.value })}
                  placeholder="60% PKC / 40% Waste"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Batch
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Edit Larvarium Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editBatchCode">Batch Code</Label>
                  <Input
                    id="editBatchCode"
                    value={editForm.batchCode}
                    onChange={(e) => setEditForm({ ...editForm, batchCode: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editStartDate">Start Date</Label>
                  <Input
                    id="editStartDate"
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editInitial">Initial Larvae (g)</Label>
                  <Input
                    id="editInitial"
                    type="number"
                    step="0.01"
                    value={editForm.initialLarvaeWeightGrams}
                    onChange={(e) => setEditForm({ ...editForm, initialLarvaeWeightGrams: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editHarvestDate">Harvest Date</Label>
                  <Input
                    id="editHarvestDate"
                    type="date"
                    value={editForm.harvestDate}
                    onChange={(e) => setEditForm({ ...editForm, harvestDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GROWING">Growing</SelectItem>
                      <SelectItem value="HARVESTED">Harvested</SelectItem>
                      <SelectItem value="PROCESSED">Processed</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editMix">Substrate Mix Ratio</Label>
                <Input
                  id="editMix"
                  value={editForm.substrateMixRatio}
                  onChange={(e) => setEditForm({ ...editForm, substrateMixRatio: e.target.value })}
                  placeholder="60% PKC / 40% Waste"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editingId === editForm.id} className="w-full">
                  {editingId === editForm.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
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


