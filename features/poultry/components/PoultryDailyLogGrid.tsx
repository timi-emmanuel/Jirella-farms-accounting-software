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
import { ClipboardCheck, Loader2, Plus, Wheat } from 'lucide-react';
import { PoultryDailyLog, PoultryFlock } from '@/types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from '@/lib/utils';
import { toast } from "@/lib/toast";

type FeedItem = {
  id: string;
  name: string;
  unit: string;
  unitSizeKg?: number | null;
  quantityOnHand: number;
};

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

export function PoultryDailyLogGrid() {
  const [rowData, setRowData] = useState<PoultryDailyLog[]>([]);
  const [flocks, setFlocks] = useState<PoultryFlock[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    flockId: '',
    eggsCollected: '',
    eggsDamaged: '',
    mortality: '',
    feedProductId: '',
    feedConsumedKg: '',
    notes: ''
  });

  const loadLogs = async () => {
    const response = await fetch('/api/poultry/daily-logs');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Daily logs load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.logs || []);
    }
  };

  const loadFlocks = async () => {
    const response = await fetch('/api/poultry/flocks');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Flocks load error:', payload.error || response.statusText);
    } else {
      setFlocks(payload.flocks || []);
    }
  };

  const loadFeedItems = async () => {
    const response = await fetch('/api/poultry/feed-items');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Feed items load error:', payload.error || response.statusText);
    } else {
      setFeedItems(payload.items || []);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadLogs(), loadFlocks(), loadFeedItems()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showAdd) {
      loadFlocks();
      loadFeedItems();
    }
  }, [showAdd]);

  useEffect(() => {
    const loadExisting = async () => {
      if (!form.flockId || !form.date) {
        setEditingId(null);
        return;
      }
      const response = await fetch(`/api/poultry/daily-logs?flockId=${form.flockId}&from=${form.date}&to=${form.date}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('Existing daily log check error:', payload.error || response.statusText);
        return;
      }
      const existing = (payload.logs || [])[0];
      if (existing) {
        setEditingId(existing.id);
        setForm((prev) => ({
          ...prev,
          eggsCollected: String(existing.eggsCollected ?? ''),
          eggsDamaged: String(existing.eggsDamaged ?? ''),
          mortality: String(existing.mortality ?? ''),
          feedProductId: existing.feedProductId ?? '',
          feedConsumedKg: String(existing.feedConsumedKg ?? ''),
          notes: existing.notes ?? ''
        }));
      } else {
        setEditingId(null);
      }
    };
    loadExisting();
  }, [form.flockId, form.date]);

  const selectedFeed = useMemo(
    () => feedItems.find((item) => item.id === form.feedProductId),
    [feedItems, form.feedProductId]
  );

  const feedQtyKg = Number(form.feedConsumedKg || 0);
  const feedUnitSize = Number(selectedFeed?.unitSizeKg || 0);
  const feedAvailableUnits = Number(selectedFeed?.quantityOnHand || 0);
  const feedAvailableKg = selectedFeed?.unit === 'BAG' && feedUnitSize > 0
    ? feedAvailableUnits * feedUnitSize
    : feedAvailableUnits;
  const feedOver = feedQtyKg > 0 && feedQtyKg > feedAvailableKg;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.flockId) {
      toast({
        title: "Missing flock",
        description: "Please select a flock before saving.",
        variant: "destructive"
      });
      return;
    }
    const eggsCollected = Number(form.eggsCollected || 0);
    const eggsDamaged = Number(form.eggsDamaged || 0);
    const feedConsumed = Number(form.feedConsumedKg || 0);
    if (eggsCollected < 0 || eggsDamaged < 0) {
      toast({
        title: "Invalid eggs",
        description: "Eggs collected or damaged cannot be negative.",
        variant: "destructive"
      });
      return;
    }
    if (feedConsumed < 0) {
      toast({
        title: "Invalid feed",
        description: "Feed consumed cannot be negative.",
        variant: "destructive"
      });
      return;
    }
    if (!form.feedProductId || Number(form.feedConsumedKg || 0) <= 0) {
      toast({
        title: "Missing feed",
        description: "Please select a feed item and enter the amount consumed.",
        variant: "destructive"
      });
      return;
    }
    if (feedOver) {
      toast({
        title: "Error",
        description: "Feed usage exceeds available poultry stock.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    const endpoint = '/api/poultry/daily-logs';
    const response = await fetch(endpoint, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        date: form.date,
        flockId: form.flockId,
        eggsCollected: Number(form.eggsCollected || 0),
        eggsDamaged: Number(form.eggsDamaged || 0),
        mortality: Number(form.mortality || 0),
        feedProductId: form.feedProductId || null,
        feedConsumedKg: Number(form.feedConsumedKg || 0),
        notes: form.notes || null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to save daily log.',
        variant: "destructive"
      });
    } else {
      setShowAdd(false);
      setEditingId(null);
      setForm({
        date: new Date().toISOString().split('T')[0],
        flockId: '',
        eggsCollected: '',
        eggsDamaged: '',
        mortality: '',
        feedProductId: '',
        feedConsumedKg: '',
        notes: ''
      });
      loadLogs();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<PoultryDailyLog>[]>(() => [
    {
      field: "date",
      headerName: "Date",
      minWidth: 120,
      valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-')
    },
    {
      headerName: "Flock",
      flex: 1.5,
      minWidth: 170,
      valueGetter: (p: any) => p.data.flock?.name || 'Unknown'
    },
    {
      field: "eggsCollected",
      headerName: "Eggs Collected",
      type: 'numericColumn',
      minWidth: 140
    },
    {
      field: "eggsDamaged",
      headerName: "Eggs Damaged",
      type: 'numericColumn',
      minWidth: 130
    },
    {
      field: "mortality",
      headerName: "Mortality",
      type: 'numericColumn',
      minWidth: 120
    },
    {
      headerName: "Feed",
      flex: 1.4,
      minWidth: 170,
      valueGetter: (p: any) => p.data.feedProduct?.name || p.data.feedItem?.name || ''
    },
    {
      field: "feedConsumedKg",
      headerName: "Feed (kg)",
      type: 'numericColumn',
      minWidth: 120
    },
    {
      field: "notes",
      headerName: "Notes",
      flex: 1.6,
      minWidth: 200
    }
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
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6">
              <Plus className="w-4 h-4" />
              New Daily Log
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                {editingId ? 'Edit Daily Log' : 'Record Daily Log'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 py-4">
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label>Flock</Label>
                  <Select value={form.flockId} onValueChange={(value) => setForm({ ...form, flockId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select flock" />
                    </SelectTrigger>
                    <SelectContent>
                      {flocks.map((flock) => (
                        <SelectItem key={flock.id} value={flock.id}>
                          {flock.name} (Live: {flock.currentCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eggsCollected">Eggs Collected</Label>
                  <Input
                    id="eggsCollected"
                    type="number"
                    min="0"
                    value={form.eggsCollected}
                    onChange={(e) => setForm({ ...form, eggsCollected: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eggsDamaged">Eggs Damaged</Label>
                  <Input
                    id="eggsDamaged"
                    type="number"
                    min="0"
                    value={form.eggsDamaged}
                    onChange={(e) => setForm({ ...form, eggsDamaged: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mortality">Mortality</Label>
                  <Input
                    id="mortality"
                    type="number"
                    min="0"
                    value={form.mortality}
                    onChange={(e) => setForm({ ...form, mortality: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Feed Item</Label>
                  <Select value={form.feedProductId} onValueChange={(value) => setForm({ ...form, feedProductId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select feed item" />
                    </SelectTrigger>
                    <SelectContent>
                      {feedItems.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">
                          No available feed in poultry inventory.
                        </div>
                      ) : (
                        feedItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} (Avail: {Number(item.quantityOnHand || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedConsumed">Feed Consumed (kg)</Label>
                  <Input
                    id="feedConsumed"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.feedConsumedKg}
                    onChange={(e) => setForm({ ...form, feedConsumedKg: e.target.value })}
                  />
                </div>
              </div>

              {selectedFeed && (
                <div className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
                  feedOver ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}>
                  <Wheat className="w-4 h-4" />
                  <span>
                    Available: {feedAvailableKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                  </span>
                  {feedOver ? <span className="font-semibold">Insufficient poultry stock.</span> : null}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={submitting || feedOver}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 py-6 text-base font-semibold transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingId ? 'Update Daily Log' : 'Save Daily Log'}
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


