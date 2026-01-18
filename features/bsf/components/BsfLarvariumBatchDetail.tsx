"use client";

import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ColDef,
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
import { BsfBatchFeedLog, BsfLarvariumBatch, BsfHarvestYield, BsfProcessingRun } from '@/types';
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
  ClientSideRowModelModule,
  ValidationModule,
  PaginationModule,
  RowStyleModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule
]);

export function BsfLarvariumBatchDetail({ batchId }: { batchId: string }) {
  const [batch, setBatch] = useState<BsfLarvariumBatch | null>(null);
  const [feedLogs, setFeedLogs] = useState<BsfBatchFeedLog[]>([]);
  const [harvest, setHarvest] = useState<BsfHarvestYield | null>(null);
  const [processingRuns, setProcessingRuns] = useState<BsfProcessingRun[]>([]);
  const [loading, setLoading] = useState(true);

  const [feedOpen, setFeedOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [processOpen, setProcessOpen] = useState(false);

  const [feedForm, setFeedForm] = useState({
    date: new Date().toISOString().split('T')[0],
    pkcKg: '',
    poultryWasteKg: '',
    poultryWasteCostOverride: '',
    notes: ''
  });

  const [harvestForm, setHarvestForm] = useState({
    wetLarvaeKg: '',
    frassKg: '',
    residueWasteKg: ''
  });

  const [processForm, setProcessForm] = useState({
    processType: 'DRYING',
    inputWeightKg: '',
    outputDryLarvaeKg: '',
    outputLarvaeOilLiters: '',
    outputLarvaeCakeKg: '',
    energyCostEstimate: ''
  });

  const loadAll = async () => {
    setLoading(true);
    const [batchRes, feedRes, harvestRes, processRes] = await Promise.all([
      fetch(`/api/bsf/larvarium/batches/${batchId}`),
      fetch(`/api/bsf/larvarium/feed-logs?batchId=${batchId}`),
      fetch(`/api/bsf/harvests?batchId=${batchId}`),
      fetch(`/api/bsf/processing?batchId=${batchId}`)
    ]);

    const batchPayload = await batchRes.json().catch(() => ({}));
    const feedPayload = await feedRes.json().catch(() => ({}));
    const harvestPayload = await harvestRes.json().catch(() => ({}));
    const processPayload = await processRes.json().catch(() => ({}));

    if (batchRes.ok) setBatch(batchPayload.batch ?? null);
    if (feedRes.ok) setFeedLogs(feedPayload.logs ?? []);
    if (harvestRes.ok) setHarvest((harvestPayload.harvests ?? [])[0] ?? null);
    if (processRes.ok) setProcessingRuns(processPayload.runs ?? []);

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [batchId]);

  const submitFeedLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/bsf/larvarium/feed-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        ...feedForm,
        pkcKg: Number(feedForm.pkcKg || 0),
        poultryWasteKg: Number(feedForm.poultryWasteKg || 0),
        poultryWasteCostOverride: feedForm.poultryWasteCostOverride ? Number(feedForm.poultryWasteCostOverride) : null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'Failed to add feed log.');
      return;
    }

    setFeedOpen(false);
    setFeedForm({
      date: new Date().toISOString().split('T')[0],
      pkcKg: '',
      poultryWasteKg: '',
      poultryWasteCostOverride: '',
      notes: ''
    });
    loadAll();
  };

  const submitHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/bsf/harvests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        wetLarvaeKg: Number(harvestForm.wetLarvaeKg || 0),
        frassKg: Number(harvestForm.frassKg || 0),
        residueWasteKg: Number(harvestForm.residueWasteKg || 0)
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'Failed to record harvest.');
      return;
    }

    setHarvestOpen(false);
    setHarvestForm({ wetLarvaeKg: '', frassKg: '', residueWasteKg: '' });
    loadAll();
  };

  const submitProcessing = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/bsf/processing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId,
        processType: processForm.processType,
        inputWeightKg: Number(processForm.inputWeightKg || 0),
        outputDryLarvaeKg: Number(processForm.outputDryLarvaeKg || 0),
        outputLarvaeOilLiters: Number(processForm.outputLarvaeOilLiters || 0),
        outputLarvaeCakeKg: Number(processForm.outputLarvaeCakeKg || 0),
        energyCostEstimate: processForm.energyCostEstimate ? Number(processForm.energyCostEstimate) : null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || 'Failed to record processing.');
      return;
    }

    setProcessOpen(false);
    setProcessForm({
      processType: 'DRYING',
      inputWeightKg: '',
      outputDryLarvaeKg: '',
      outputLarvaeOilLiters: '',
      outputLarvaeCakeKg: '',
      energyCostEstimate: ''
    });
    loadAll();
  };

  const feedCols = useMemo<ColDef<BsfBatchFeedLog>[]>(() => [
    { field: 'date', headerName: 'Date', minWidth: 120 },
    { field: 'pkcKg', headerName: 'PKC (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'poultryWasteKg', headerName: 'Waste (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'poultryWasteCostOverride', headerName: 'Waste Cost', type: 'numericColumn', minWidth: 120 },
    { field: 'notes', headerName: 'Notes', flex: 1.4, minWidth: 180 }
  ], []);

  const processingCols = useMemo<ColDef<BsfProcessingRun>[]>(() => [
    { field: 'processType', headerName: 'Type', minWidth: 150 },
    { field: 'inputWeightKg', headerName: 'Input (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'outputDryLarvaeKg', headerName: 'Dry Larvae (kg)', type: 'numericColumn', minWidth: 140 },
    { field: 'outputLarvaeOilLiters', headerName: 'Oil (L)', type: 'numericColumn', minWidth: 120 },
    { field: 'outputLarvaeCakeKg', headerName: 'Cake (kg)', type: 'numericColumn', minWidth: 120 },
    { field: 'energyCostEstimate', headerName: 'Energy Cost', type: 'numericColumn', minWidth: 140 }
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!batch) {
    return <div className="p-6">Batch not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Batch {batch.batchCode}</h1>
        <p className="text-sm text-slate-500">Status: {batch.status}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="text-sm text-slate-600">Start Date: {batch.startDate}</div>
          <div className="text-sm text-slate-600">Initial (g): {batch.initialLarvaeWeightGrams}</div>
          <div className="text-sm text-slate-600">Mix: {batch.substrateMixRatio || 'N/A'}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Feed Logs</h2>
            <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
              <DialogTrigger asChild>
                <Button size="sm">Add Feed Log</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto modal-scrollbar">
                <DialogHeader>
                  <DialogTitle>Add Feed Log</DialogTitle>
                </DialogHeader>
                <form onSubmit={submitFeedLog} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={feedForm.date} onChange={(e) => setFeedForm({ ...feedForm, date: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>PKC (kg)</Label>
                      <Input type="number" step="0.01" value={feedForm.pkcKg} onChange={(e) => setFeedForm({ ...feedForm, pkcKg: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Poultry Waste (kg)</Label>
                      <Input type="number" step="0.01" value={feedForm.poultryWasteKg} onChange={(e) => setFeedForm({ ...feedForm, poultryWasteKg: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Waste Cost Override (per kg)</Label>
                    <Input type="number" step="0.01" value={feedForm.poultryWasteCostOverride} onChange={(e) => setFeedForm({ ...feedForm, poultryWasteCostOverride: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={feedForm.notes} onChange={(e) => setFeedForm({ ...feedForm, notes: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full">Save Log</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="h-[360px]">
            <AgGridReact
              theme={themeQuartz}
              rowData={feedLogs}
              columnDefs={feedCols}
              defaultColDef={{ sortable: true, filter: true, wrapHeaderText: true, autoHeaderHeight: true }}
              pagination={true}
              paginationPageSize={10}
            />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Harvest</h2>
            <Dialog open={harvestOpen} onOpenChange={setHarvestOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!!harvest}>Record Harvest</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Record Harvest</DialogTitle>
                </DialogHeader>
                <form onSubmit={submitHarvest} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Wet Larvae (kg)</Label>
                      <Input type="number" step="0.01" value={harvestForm.wetLarvaeKg} onChange={(e) => setHarvestForm({ ...harvestForm, wetLarvaeKg: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Frass (kg)</Label>
                      <Input type="number" step="0.01" value={harvestForm.frassKg} onChange={(e) => setHarvestForm({ ...harvestForm, frassKg: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Residue Waste (kg)</Label>
                    <Input type="number" step="0.01" value={harvestForm.residueWasteKg} onChange={(e) => setHarvestForm({ ...harvestForm, residueWasteKg: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full">Save Harvest</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {harvest ? (
            <div className="grid gap-3 text-sm text-slate-600">
              <div>Wet Larvae: {harvest.wetLarvaeKg} kg</div>
              <div>Frass: {harvest.frassKg} kg</div>
              <div>Residue Waste: {harvest.residueWasteKg} kg</div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No harvest recorded yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Processing Runs</h2>
          <Dialog open={processOpen} onOpenChange={setProcessOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add Processing</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto modal-scrollbar">
              <DialogHeader>
                <DialogTitle>Record Processing</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitProcessing} className="space-y-3">
                <div className="space-y-2">
                  <Label>Process Type</Label>
                  <Select value={processForm.processType} onValueChange={(value) => setProcessForm({ ...processForm, processType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRYING">Drying</SelectItem>
                      <SelectItem value="PRESSING_EXTRACTION">Pressing / Extraction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Input Weight (kg)</Label>
                    <Input type="number" step="0.01" value={processForm.inputWeightKg} onChange={(e) => setProcessForm({ ...processForm, inputWeightKg: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Energy Cost</Label>
                    <Input type="number" step="0.01" value={processForm.energyCostEstimate} onChange={(e) => setProcessForm({ ...processForm, energyCostEstimate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Dry Larvae (kg)</Label>
                    <Input type="number" step="0.01" value={processForm.outputDryLarvaeKg} onChange={(e) => setProcessForm({ ...processForm, outputDryLarvaeKg: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Oil (L)</Label>
                    <Input type="number" step="0.01" value={processForm.outputLarvaeOilLiters} onChange={(e) => setProcessForm({ ...processForm, outputLarvaeOilLiters: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cake (kg)</Label>
                    <Input type="number" step="0.01" value={processForm.outputLarvaeCakeKg} onChange={(e) => setProcessForm({ ...processForm, outputLarvaeCakeKg: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Save Processing</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="h-[320px]">
          <AgGridReact
            theme={themeQuartz}
            rowData={processingRuns}
            columnDefs={processingCols}
            defaultColDef={{ sortable: true, filter: true, wrapHeaderText: true, autoHeaderHeight: true }}
            pagination={true}
            paginationPageSize={10}
          />
        </div>
      </div>
    </div>
  );
}
