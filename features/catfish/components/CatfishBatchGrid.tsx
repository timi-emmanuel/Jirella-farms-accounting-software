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
import { Loader2, Plus } from 'lucide-react';
import { CatfishBatch, CatfishPond } from '@/types';
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
import { formatCatfishStage, getCatfishAgeWeeks, getCatfishStage } from '@/lib/catfish';

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

export function CatfishBatchGrid() {
  const [rowData, setRowData] = useState<CatfishBatch[]>([]);
  const [ponds, setPonds] = useState<CatfishPond[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchCode: '',
    pondId: '',
    startDate: new Date().toISOString().split('T')[0],
    initialFingerlingsCount: '',
    fingerlingUnitCost: '',
    status: 'GROWING',
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const [batchRes, pondRes] = await Promise.all([
      fetch('/api/catfish/batches'),
      fetch('/api/catfish/ponds')
    ]);

    const batchPayload = await batchRes.json().catch(() => ({}));
    const pondPayload = await pondRes.json().catch(() => ({}));

    if (batchRes.ok) setRowData(batchPayload.batches || []);
    if (pondRes.ok) setPonds(pondPayload.ponds || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchCode || !form.pondId) return;

    setSubmitting(true);
    const response = await fetch('/api/catfish/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchCode: form.batchCode,
        pondId: form.pondId,
        startDate: form.startDate,
        initialFingerlingsCount: Number(form.initialFingerlingsCount || 0),
        fingerlingUnitCost: Number(form.fingerlingUnitCost || 0),
        status: form.status,
        notes: form.notes
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'Failed to create batch.');
    } else {
      setDialogOpen(false);
      setForm({
        batchCode: '',
        pondId: '',
        startDate: new Date().toISOString().split('T')[0],
        initialFingerlingsCount: '',
        fingerlingUnitCost: '',
        status: 'GROWING',
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<CatfishBatch>[]>(() => [
    {
      headerName: 'Batch Code',
      minWidth: 160,
      field: 'batchCode',
      cellRenderer: (params: any) => (
        <Link className="text-emerald-700 font-semibold" href={`/catfish/batches/${params.data.id}`}>
          {params.value}
        </Link>
      )
    },
    { field: 'startDate', headerName: 'Start Date', minWidth: 120 },
    { headerName: 'Pond', minWidth: 140, valueGetter: (p: any) => p.data.pond?.name || 'Unknown' },
    { headerName: 'Age (wks)', minWidth: 120, valueGetter: (p: any) => getCatfishAgeWeeks(p.data.startDate) },
    { headerName: 'Stage', minWidth: 160, valueGetter: (p: any) => formatCatfishStage(getCatfishStage(p.data.startDate)) },
    { field: 'initialFingerlingsCount', headerName: 'Quantity', type: 'numericColumn', minWidth: 130 },
    {
      field: 'fingerlingUnitCost',
      headerName: 'Unit Cost',
      type: 'numericColumn',
      minWidth: 120,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'totalFingerlingCost',
      headerName: 'Total Cost',
      type: 'numericColumn',
      minWidth: 130,
      valueFormatter: (p: any) => `NGN ${Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 120,
      cellRenderer: (params: any) => {
        const value = String(params.value || '');
        const color =
          value === 'GROWING'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : value === 'HARVESTING'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-slate-100 text-slate-700 border-slate-200';
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
            {value}
          </span>
        );
      }
    },
    { field: 'notes', headerName: 'Notes', flex: 1.2, minWidth: 200 }
  ], []);

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
            <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-6">
              <Plus className="w-4 h-4" />
              New Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Create Catfish Batch</DialogTitle>
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
              <div className="space-y-2">
                <Label>Pond</Label>
                <Select value={form.pondId} onValueChange={(value) => setForm({ ...form, pondId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pond" />
                  </SelectTrigger>
                  <SelectContent>
                    {ponds.map((pond) => (
                      <SelectItem key={pond.id} value={pond.id}>
                        {pond.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={form.initialFingerlingsCount}
                    onChange={(e) => setForm({ ...form, initialFingerlingsCount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.fingerlingUnitCost}
                    onChange={(e) => setForm({ ...form, fingerlingUnitCost: e.target.value })}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Stages auto-update by batch age: Fries (0-2 wks), Fingerlings (3-6), Juveniles (7-12),
                Melange (13-20), Adults (21-32), Parent Stock (33+).
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROWING">Growing</SelectItem>
                    <SelectItem value="HARVESTING">Harvesting</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
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


