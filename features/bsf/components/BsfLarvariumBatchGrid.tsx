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
import { Loader2, Plus } from 'lucide-react';
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
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchCode: '',
    startDate: new Date().toISOString().split('T')[0],
    initialLarvaeWeightGrams: '',
    substrateMixRatio: '',
    status: 'GROWING',
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
        initialLarvaeWeightGrams: '',
        substrateMixRatio: '',
        status: 'GROWING',
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
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
    { field: 'startDate', headerName: 'Start Date', minWidth: 120 },
    {
      field: 'initialLarvaeWeightGrams',
      headerName: 'Initial (g)',
      type: 'numericColumn',
      minWidth: 120
    },
    { field: 'status', headerName: 'Status', minWidth: 120 },
    { field: 'harvestDate', headerName: 'Harvest Date', minWidth: 120 },
    { field: 'substrateMixRatio', headerName: 'Mix Ratio', flex: 1.2, minWidth: 180 },
    { field: 'notes', headerName: 'Notes', flex: 1.4, minWidth: 200 }
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

