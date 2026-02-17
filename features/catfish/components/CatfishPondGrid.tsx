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
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { CatfishPond } from '@/types';
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

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const datePart = parsed.toLocaleDateString('en-GB');
  const timePart = parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${timePart}`.replace(/\//g, '-');
};

export function CatfishPondGrid() {
  const [rowData, setRowData] = useState<CatfishPond[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    capacityFish: '',
    waterType: 'EARTHEN',
    status: 'ACTIVE'
  });
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    capacityFish: '',
    waterType: 'EARTHEN',
    status: 'ACTIVE'
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/catfish/ponds');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Catfish ponds load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.ponds || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    setSubmitting(true);
    const response = await fetch('/api/catfish/ponds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        capacityFish: Number(form.capacityFish || 0),
        waterType: form.waterType,
        status: form.status
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to create pond.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        name: '',
        capacityFish: '',
        waterType: 'EARTHEN',
        status: 'ACTIVE'
      });
      loadData();
    }
    setSubmitting(false);
  };

  const handleDelete = async (pond: CatfishPond) => {
    if (!confirm(`Delete pond "${pond.name}"? This cannot be undone.`)) return;
    setDeletingId(pond.id);
    const response = await fetch(`/api/catfish/ponds?id=${pond.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to delete pond.',
        variant: "destructive"
      });
    } else {
      loadData();
    }
    setDeletingId(null);
  };

  const openEdit = (pond: CatfishPond) => {
    setEditForm({
      id: pond.id,
      name: pond.name ?? '',
      capacityFish: String(pond.capacityFish ?? ''),
      waterType: pond.waterType ?? 'EARTHEN',
      status: pond.status ?? 'ACTIVE'
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id || !editForm.name) return;

    setEditingId(editForm.id);
    const response = await fetch(`/api/catfish/ponds?id=${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        capacityFish: Number(editForm.capacityFish || 0),
        waterType: editForm.waterType,
        status: editForm.status
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to update pond.',
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Pond updated successfully.",
        variant: "success"
      });
      setEditDialogOpen(false);
      loadData();
    }
    setEditingId(null);
  };

  const colDefs = useMemo<ColDef<CatfishPond>[]>(() => [
    { field: 'name', headerName: 'Pond', minWidth: 160 },
    { field: 'capacityFish', headerName: 'Capacity', type: 'numericColumn', minWidth: 120 },
    { field: 'waterType', headerName: 'Water Type', minWidth: 140 },
    { field: 'status', headerName: 'Status', minWidth: 120 },
    { field: 'createdAt', headerName: 'Created', minWidth: 160, valueFormatter: (p) => formatDateTime(p.value) },
    {
      headerName: "Actions",
      width: 160,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const pond = params.data as CatfishPond;
        const isDeleting = deletingId === pond.id;
        const isEditing = editingId === pond.id;
        return (
          <div className="flex items-center justify-center h-full w-full gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500 hover:text-blue-600 hover:bg-transparent"
              disabled={isDeleting || isEditing}
              onClick={() => openEdit(pond)}
            >
              {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-slate-500 hover:text-rose-600 hover:bg-transparent"
              disabled={isDeleting || isEditing}
              onClick={() => handleDelete(pond)}
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
              New Pond
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Create Pond</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pond-name">Pond Name</Label>
                <Input
                  id="pond-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity (fish)</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={form.capacityFish}
                    onChange={(e) => setForm({ ...form, capacityFish: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Water Type</Label>
                  <Select value={form.waterType} onValueChange={(value) => setForm({ ...form, waterType: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Water type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EARTHEN">Earthen</SelectItem>
                      <SelectItem value="CONCRETE">Concrete</SelectItem>
                      <SelectItem value="TANK">Tank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Pond
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Edit Pond</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-pond-name">Pond Name</Label>
                <Input
                  id="edit-pond-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-capacity">Capacity (fish)</Label>
                  <Input
                    id="edit-capacity"
                    type="number"
                    value={editForm.capacityFish}
                    onChange={(e) => setEditForm({ ...editForm, capacityFish: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Water Type</Label>
                  <Select value={editForm.waterType} onValueChange={(value) => setEditForm({ ...editForm, waterType: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Water type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EARTHEN">Earthen</SelectItem>
                      <SelectItem value="CONCRETE">Concrete</SelectItem>
                      <SelectItem value="TANK">Tank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
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


