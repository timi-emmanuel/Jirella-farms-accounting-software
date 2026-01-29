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
import { CatfishBatch, CatfishMortalityLog } from '@/types';
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

export function CatfishMortalityGrid({ batchId, hideBatchColumn }: Props) {
  const [rowData, setRowData] = useState<CatfishMortalityLog[]>([]);
  const [batches, setBatches] = useState<CatfishBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchId: batchId || '',
    date: new Date().toISOString().split('T')[0],
    deadCount: '',
    cause: ''
  });

  const loadData = async () => {
    setLoading(true);
    const query = batchId ? `?batchId=${batchId}` : '';
    const [logRes, batchRes] = await Promise.all([
      fetch(`/api/catfish/mortality${query}`),
      fetch('/api/catfish/batches')
    ]);

    const logPayload = await logRes.json().catch(() => ({}));
    const batchPayload = await batchRes.json().catch(() => ({}));

    if (logRes.ok) setRowData(logPayload.mortalities || []);
    if (batchRes.ok) setBatches(batchPayload.batches || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId || Number(form.deadCount) <= 0) return;

    setSubmitting(true);
    const response = await fetch('/api/catfish/mortality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: form.batchId,
        date: form.date,
        deadCount: Number(form.deadCount || 0),
        cause: form.cause
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log mortality.',
        variant: "destructive"
      });
    } else {
      setDialogOpen(false);
      setForm({
        batchId: batchId || '',
        date: new Date().toISOString().split('T')[0],
        deadCount: '',
        cause: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<CatfishMortalityLog>[]>(() => {
    const cols: ColDef<CatfishMortalityLog>[] = [
      { field: 'date', headerName: 'Date', minWidth: 120, valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-') }
    ];
    if (!hideBatchColumn) {
      cols.push({
        headerName: 'Batch',
        minWidth: 140,
        valueGetter: (p: any) => p.data.batch?.batchCode || 'Unknown'
      });
    }
    cols.push(
      { field: 'deadCount', headerName: 'Dead Count', type: 'numericColumn', minWidth: 130 },
      { field: 'cause', headerName: 'Cause', minWidth: 160, flex: 1 },
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
              Log Mortality
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-140 max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log Mortality</DialogTitle>
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
              <div className="flex flex-col gap-4 md:flex-row">
                <div className='space-y-2 flex-1'>
                   <Label>Date</Label>
                   <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>           
                <div className="space-y-2 flex-1">
                  <Label>Dead Count</Label>
                  <Input type="number" value={form.deadCount} onChange={(e) => setForm({ ...form, deadCount: e.target.value })} />
              </div>
              </div>              
              <div className="space-y-2">
                <Label>Cause</Label>
                <Input value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} />
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

      <div className="h-80 border rounded-2xl overflow-hidden bg-white shadow-xl shadow-slate-200/50">
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


