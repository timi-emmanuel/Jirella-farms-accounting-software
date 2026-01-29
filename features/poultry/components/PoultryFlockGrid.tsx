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
import { toast } from "@/lib/toast";
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { PoultryFlock } from '@/types';
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

export function PoultryFlockGrid() {
  const [rowData, setRowData] = useState<PoultryFlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    breed: '',
    initialCount: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/poultry/flocks');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Flock load error:', payload.error || response.statusText);
        toast({
          title: "Error",
          description: payload.error || 'Failed to load flocks. Please try again.',
          variant: "destructive"
        });
      } else {
        setRowData(payload.flocks || []);
      }
    } catch (error: any) {
      console.error('Flock load error:', error);
      const message =
        typeof error?.message === 'string' && error.message.toLowerCase().includes('fetch')
          ? 'Network error: unable to reach the server. Check your connection and try again.'
          : 'Unexpected error while loading flocks. Please try again.';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || Number(form.initialCount) < 0) return;
    setSubmitting(true);

    const response = await fetch('/api/poultry/flocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        breed: form.breed || null,
        initialCount: Number(form.initialCount),
        startDate: form.startDate,
        status: form.status
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to create flock.',
        variant: "destructive"
      });
    } else {
      setShowAdd(false);
      setForm({
        name: '',
        breed: '',
        initialCount: '',
        startDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE'
      });
      loadData();
    }
    setSubmitting(false);
  };

  const handleDelete = async (flock: PoultryFlock) => {
    if (!confirm(`Delete flock "${flock.name}"? This cannot be undone.`)) return;
    setDeletingId(flock.id);
    const response = await fetch(`/api/poultry/flocks?id=${flock.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to delete flock.',
        variant: "destructive"
      });
    } else {
      loadData();
    }
    setDeletingId(null);
  };

  const colDefs = useMemo<ColDef<PoultryFlock>[]>(() => [
    {
      field: "name",
      headerName: "Flock",
      flex: 1.4,
      minWidth: 170,
      filter: true,
      cellStyle: { fontWeight: '600', color: '#0f172a' }
    },
    {
      field: "breed",
      headerName: "Breed",
      flex: 1,
      minWidth: 130
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      cellRenderer: (params: any) => {
        const status = params.value;
        const colorClass = status === 'ACTIVE'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-100 text-slate-600';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${colorClass}`}>
            {status}
          </span>
        );
      }
    },
    {
      field: "startDate",
      headerName: "Start Date",
      minWidth: 140,
      valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-')
    },
    {
      field: "initialCount",
      headerName: "Initial Birds",
      type: 'numericColumn',
      minWidth: 140
    },
    {
      field: "currentCount",
      headerName: "Current Birds",
      type: 'numericColumn',
      minWidth: 140
    },
    {
      headerName: "Actions",
      width: 110,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const flock = params.data as PoultryFlock;
        const isDeleting = deletingId === flock.id;
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-slate-500 hover:text-rose-600 hover:bg-transparent"
            disabled={isDeleting}
            onClick={() => handleDelete(flock)}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        );
      }
    }
  ], [deletingId]);

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
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6">
              <Plus className="w-4 h-4" />
              New Flock
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-130">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Create Flock
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="flockName">Flock Name</Label>
                <Input
                  id="flockName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Batch A - Jan 2026"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="breed">Breed (optional)</Label>
                  <Input
                    id="breed"
                    value={form.breed}
                    onChange={(e) => setForm({ ...form, breed: e.target.value })}
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
                  <Label htmlFor="initialCount">Initial Bird Count</Label>
                  <Input
                    id="initialCount"
                    type="number"
                    value={form.initialCount}
                    onChange={(e) => setForm({ ...form, initialCount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="CLOSED">CLOSED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Flock
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


