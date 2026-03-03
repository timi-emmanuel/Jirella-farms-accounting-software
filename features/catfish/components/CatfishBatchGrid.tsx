/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from 'react';
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
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { CatfishBatch } from '@/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from "@/lib/toast";

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
  productionType?: 'Fingerlings' | 'Juvenile' | 'Melange';
  basePath?: string;
  stageLabel?: string;
};

export function CatfishBatchGrid({
  productionType = 'Fingerlings',
  basePath = '/catfish/fingerlings',
  stageLabel = 'Fingerlings'
}: Props) {
  const getToday = () => new Date().toISOString().split('T')[0];
  const [rowData, setRowData] = useState<CatfishBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    batchName: '',
    startDate: getToday(),
    expectedHarvestDate: '',
    initialStock: '',
    initialSeedCost: '',
    status: 'Active'
  });
  const [editForm, setEditForm] = useState({
    id: '',
    batchName: '',
    startDate: getToday(),
    expectedHarvestDate: '',
    initialStock: '',
    initialSeedCost: '',
    status: 'Active'
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch(`/api/catfish/batches?productionType=${productionType}`);
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setRowData(payload.batches || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [productionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchName.trim()) {
      toast({ title: "Error", description: "Batch name is required.", variant: "destructive" });
      return;
    }
    if (!form.initialStock || Number(form.initialStock) <= 0) {
      toast({ title: "Error", description: "Initial stock must be greater than zero.", variant: "destructive" });
      return;
    }
    if (Number(form.initialSeedCost || 0) < 0) {
      toast({ title: "Error", description: "Initial seed cost cannot be negative.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const response = await fetch('/api/catfish/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchName: form.batchName,
        productionType,
        startDate: form.startDate,
        expectedHarvestDate: form.expectedHarvestDate || null,
        initialStock: Number(form.initialStock || 0),
        initialSeedCost: Number(form.initialSeedCost || 0),
        status: form.status
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ title: "Error", description: payload.error || 'Failed to create batch.', variant: "destructive" });
    } else {
      setDialogOpen(false);
      setForm({
        batchName: '',
        startDate: getToday(),
        expectedHarvestDate: '',
        initialStock: '',
        initialSeedCost: '',
        status: 'Active'
      });
      loadData();
    }
    setSubmitting(false);
  };

  const handleDelete = async (batch: CatfishBatch) => {
    if (!confirm(`Delete batch "${batch.batchName}"? This cannot be undone.`)) return;
    setDeletingId(batch.id);
    const response = await fetch(`/api/catfish/batches?id=${batch.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ title: "Error", description: payload.error || 'Failed to delete batch.', variant: "destructive" });
    } else {
      loadData();
    }
    setDeletingId(null);
  };

  const openEdit = (batch: CatfishBatch) => {
    setEditForm({
      id: batch.id,
      batchName: batch.batchName || '',
      startDate: batch.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : getToday(),
      expectedHarvestDate: batch.expectedHarvestDate ? new Date(batch.expectedHarvestDate).toISOString().split('T')[0] : '',
      initialStock: String(batch.initialStock || ''),
      initialSeedCost: String(batch.initialSeedCost || ''),
      status: batch.status === 'Completed' ? 'Completed' : 'Active'
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id || !editForm.batchName.trim()) return;
    setEditingId(editForm.id);

    const response = await fetch(`/api/catfish/batches?id=${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchName: editForm.batchName,
        productionType,
        startDate: editForm.startDate,
        expectedHarvestDate: editForm.expectedHarvestDate || null,
        initialStock: Number(editForm.initialStock || 0),
        initialSeedCost: Number(editForm.initialSeedCost || 0),
        status: editForm.status
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({ title: "Error", description: payload.error || 'Failed to update batch.', variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Batch updated successfully.", variant: "success" });
      setEditDialogOpen(false);
      loadData();
    }
    setEditingId(null);
  };

  const colDefs: ColDef<CatfishBatch>[] = [
    {
      headerName: 'Batch Name',
      minWidth: 180,
      field: 'batchName',
      filter: false,
      cellRenderer: (params: any) => (
        <Link className="text-emerald-700 font-semibold" href={`${basePath}/${params.data.id}`}>
          {params.value}
        </Link>
      )
    },
    { field: 'startDate', headerName: 'Start Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') },
    { field: 'expectedHarvestDate', headerName: 'Expected Harvest', minWidth: 140, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') : '-' },
    { field: 'productionType', headerName: 'Type', minWidth: 120, valueGetter: (p: any) => p.data.productionType || 'Fingerlings' },
    { field: 'initialStock', headerName: 'Initial Stock', type: 'numericColumn', minWidth: 130 },
    { field: 'mortalityTotal', headerName: 'Mortality', type: 'numericColumn', minWidth: 120, valueGetter: (p: any) => Number(p.data.mortalityTotal || 0) },
    { field: 'totalSold', headerName: 'Sold', type: 'numericColumn', minWidth: 100, valueGetter: (p: any) => Number(p.data.totalSold || 0) },
    { field: 'currentPopulation', headerName: 'Current Pop.', type: 'numericColumn', minWidth: 120, valueGetter: (p: any) => Number(p.data.currentPopulation || 0) },
    {
      field: 'initialSeedCost',
      headerName: 'Seed Cost (₦)',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => `${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 120,
      cellRenderer: (params: any) => {
        const value = String(params.value || '');
        const color = value === 'Active'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
            {value}
          </span>
        );
      }
    },
    {
      headerName: "Actions",
      width: 160,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const batch = params.data as CatfishBatch;
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
  ];

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
              <DialogTitle className="text-xl font-bold tracking-tight">Create {stageLabel} Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="batchName">Batch Name</Label>
                <Input id="batchName" value={form.batchName} onChange={(e) => setForm({ ...form, batchName: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedHarvestDate">Expected Harvest Date</Label>
                  <Input id="expectedHarvestDate" type="date" value={form.expectedHarvestDate} onChange={(e) => setForm({ ...form, expectedHarvestDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Initial Stock</Label>
                  <Input type="number" min="1" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Initial Seed Cost (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={form.initialSeedCost} onChange={(e) => setForm({ ...form, initialSeedCost: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
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
              <DialogTitle className="text-xl font-bold tracking-tight">Edit {stageLabel} Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="editBatchName">Batch Name</Label>
                <Input id="editBatchName" value={editForm.batchName} onChange={(e) => setEditForm({ ...editForm, batchName: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editStartDate">Start Date</Label>
                  <Input id="editStartDate" type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editExpectedHarvestDate">Expected Harvest Date</Label>
                  <Input id="editExpectedHarvestDate" type="date" value={editForm.expectedHarvestDate} onChange={(e) => setEditForm({ ...editForm, expectedHarvestDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Initial Stock</Label>
                  <Input type="number" min="1" value={editForm.initialStock} onChange={(e) => setEditForm({ ...editForm, initialStock: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Initial Seed Cost (₦)</Label>
                  <Input type="number" min="0" step="0.01" value={editForm.initialSeedCost} onChange={(e) => setEditForm({ ...editForm, initialSeedCost: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
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
          suppressMovableColumns={typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches}
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

