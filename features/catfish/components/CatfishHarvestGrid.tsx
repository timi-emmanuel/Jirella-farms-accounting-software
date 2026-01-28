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
import { Loader2, Plus } from 'lucide-react';
import { CatfishBatch, CatfishHarvest } from '@/types';
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

type Props = {
  batchId?: string;
  hideBatchColumn?: boolean;
};

export function CatfishHarvestGrid({ batchId, hideBatchColumn }: Props) {
  const [rowData, setRowData] = useState<CatfishHarvest[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchId: batchId || '',
    date: new Date().toISOString().split('T')[0],
    quantityKg: '',
    fishCountHarvested: '',
    averageFishWeightKg: '',
    notes: '',
    closeBatch: false
  });

  const loadData = async () => {
    setLoading(true);
    const query = batchId ? `?batchId=${batchId}` : '';
    const [harvestRes, batchRes] = await Promise.all([
      fetch(`/api/catfish/harvests${query}`),
      fetch('/api/catfish/batches')
    ]);

    const harvestPayload = await harvestRes.json().catch(() => ({}));
    const batchPayload = await batchRes.json().catch(() => ({}));

    if (harvestRes.ok) setRowData(harvestPayload.harvests || []);
    if (batchRes.ok) setBatches(batchPayload.batches || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId || Number(form.quantityKg) <= 0) return;

    setSubmitting(true);
    const response = await fetch('/api/catfish/harvests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: form.batchId,
        date: form.date,
        quantityKg: Number(form.quantityKg || 0),
        fishCountHarvested: form.fishCountHarvested ? Number(form.fishCountHarvested) : null,
        averageFishWeightKg: Number(form.averageFishWeightKg || 0),
        notes: form.notes,
        closeBatch: form.closeBatch
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log harvest.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        batchId: batchId || '',
        date: new Date().toISOString().split('T')[0],
        quantityKg: '',
        fishCountHarvested: '',
        averageFishWeightKg: '',
        notes: '',
        closeBatch: false
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<CatfishHarvest>[]>(() => {
    const cols: ColDef<CatfishHarvest>[] = [
      { field: 'date', headerName: 'Date', minWidth: 120 }
    ];
    if (!hideBatchColumn) {
      cols.push({
        headerName: 'Batch',
        minWidth: 140,
        valueGetter: (p: any) => p.data.batch?.batchCode || 'Unknown'
      });
    }
    cols.push(
      { field: 'quantityKg', headerName: 'Harvest Weight (kg)', type: 'numericColumn', minWidth: 160 },
      {
        field: 'fishCountHarvested',
        headerName: 'Fish Count',
        type: 'numericColumn',
        minWidth: 130,
        valueGetter: (p: any) => {
          const value = p.data.fishCountHarvested;
          if (value === null || value === undefined) return null;
          const numeric = Number(value);
          return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
        },
        valueFormatter: (p: any) => (p.value === null || p.value === undefined ? '-' : Number(p.value).toLocaleString())
      },
      { field: 'averageFishWeightKg', headerName: 'Avg Weight (kg)', type: 'numericColumn', minWidth: 150 },
      { field: 'notes', headerName: 'Notes', flex: 1.2, minWidth: 200 }
    );
    return cols;
  }, [hideBatchColumn]);

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
              Log Harvest
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log Harvest</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                          {batch.batchCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Harvest Weight (kg)</Label>
                  <Input type="number" step="0.01" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Avg Fish Weight (kg)</Label>
                  <Input type="number" step="0.01" value={form.averageFishWeightKg} onChange={(e) => setForm({ ...form, averageFishWeightKg: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fish Count Harvested (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.fishCountHarvested}
                  onChange={(e) => setForm({ ...form, fishCountHarvested: e.target.value })}
                />
                <p className="text-xs text-slate-500">
                  Leave blank if you didn&apos;t count fish. This won&apos;t change fish count.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  id="closeBatch"
                  type="checkbox"
                  checked={form.closeBatch}
                  onChange={(e) => setForm({ ...form, closeBatch: e.target.checked })}
                />
                <Label htmlFor="closeBatch">Final harvest (close batch)</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Harvest
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="h-[320px] border rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/50">
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
          overlayNoRowsTemplate="<span class='text-slate-500'>No records found</span>"
          pagination={true}
          paginationPageSize={20}
        />
      </div>
    </div>
  );
}


