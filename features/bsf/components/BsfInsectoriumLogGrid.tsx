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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { BsfInsectoriumLog } from '@/types';
import { toast } from "@/lib/toast";
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

export function BsfInsectoriumLogGrid() {
  const [rowData, setRowData] = useState<BsfInsectoriumLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    pupaeLoadedKg: '',
    eggsHarvestedGrams: '',
    pupaeShellsHarvestedKg: '',
    deadFlyKg: '',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/bsf/insectorium');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Insectorium logs load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.logs || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const response = await fetch('/api/bsf/insectorium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        pupaeLoadedKg: Number(form.pupaeLoadedKg || 0),
        eggsHarvestedGrams: Number(form.eggsHarvestedGrams || 0),
        pupaeShellsHarvestedKg: Number(form.pupaeShellsHarvestedKg || 0),
        deadFlyKg: Number(form.deadFlyKg || 0)
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to record insectorium log.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        pupaeLoadedKg: '',
        eggsHarvestedGrams: '',
        pupaeShellsHarvestedKg: '',
        deadFlyKg: '',
        notes: ''
      });
      loadData();
    }

    setSubmitting(false);
  };

  const handleDelete = async (log: BsfInsectoriumLog) => {
    if (!confirm(`Delete insectorium log on ${log.date}? This cannot be undone.`)) return;
    setDeletingId(log.id);
    const response = await fetch(`/api/bsf/insectorium?id=${log.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to delete log.',
        variant: "destructive"
      });
    } else {
      loadData();
    }
    setDeletingId(null);
  };

  const colDefs = useMemo<ColDef<BsfInsectoriumLog>[]>(() => [
    { field: 'date', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') },
    { field: 'pupaeLoadedKg', headerName: 'Pupae Loaded (kg)', type: 'numericColumn', minWidth: 160 },
    { field: 'eggsHarvestedGrams', headerName: 'Eggs Harvested (g)', type: 'numericColumn', minWidth: 170 },
    { field: 'pupaeShellsHarvestedKg', headerName: 'Pupae Shells (kg)', type: 'numericColumn', minWidth: 170 },
    { field: 'deadFlyKg', headerName: 'Dead Fly (kg)', type: 'numericColumn', minWidth: 140 },
    { field: 'notes', headerName: 'Notes', flex: 1.5, minWidth: 200 },
    {
      headerName: "Actions",
      width: 110,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const log = params.data as BsfInsectoriumLog;
        const isDeleting = deletingId === log.id;
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-slate-500 hover:text-rose-600 hover:bg-transparent"
            disabled={isDeleting}
            onClick={() => handleDelete(log)}
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6">
              <Plus className="w-4 h-4" />
              New Log
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Insectorium Daily Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="logDate">Date</Label>
                <Input
                  id="logDate"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pupaeLoaded">Pupae Loaded (kg)</Label>
                  <Input
                    id="pupaeLoaded"
                    type="number"
                    step="0.01"
                    value={form.pupaeLoadedKg}
                    onChange={(e) => setForm({ ...form, pupaeLoadedKg: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eggsHarvested">Eggs Harvested (g)</Label>
                  <Input
                    id="eggsHarvested"
                    type="number"
                    step="0.01"
                    value={form.eggsHarvestedGrams}
                    onChange={(e) => setForm({ ...form, eggsHarvestedGrams: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shells">Pupae Shells (kg)</Label>
                  <Input
                    id="shells"
                    type="number"
                    step="0.01"
                    value={form.pupaeShellsHarvestedKg}
                    onChange={(e) => setForm({ ...form, pupaeShellsHarvestedKg: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadFlyKg">Dead Fly (kg)</Label>
                  <Input
                    id="deadFlyKg"
                    type="number"
                    step="0.01"
                    value={form.deadFlyKg}
                    onChange={(e) => setForm({ ...form, deadFlyKg: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Observations or dead fly notes"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Log
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


