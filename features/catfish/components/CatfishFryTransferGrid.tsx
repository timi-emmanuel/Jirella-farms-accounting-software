"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
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
} from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

type SpawningEvent = {
  id: string;
  eventDate: string;
  status: "Incubating" | "Completed" | "Failed";
};

type FryTransfer = {
  id: string;
  spawningEventId: string;
  transferDate: string;
  liveFryCount: number;
  internalPricePerFry: number;
  sacrificedMaleWeightKg: number;
  sacrificedMaleMeatPrice: number;
  totalTransferValue: number;
  toBatchId?: string | null;
  toBatch?: { id: string; batchName: string; productionType: string };
};

export function CatfishFryTransferGrid() {
  const [rows, setRows] = useState<FryTransfer[]>([]);
  const [events, setEvents] = useState<SpawningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    spawningEventId: "",
    transferDate: new Date().toISOString().split("T")[0],
    liveFryCount: "",
    internalPricePerFry: "",
    sacrificedMaleMeatPrice: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    const [transferRes, eventRes] = await Promise.all([
      fetch("/api/catfish/hatchery/transfers"),
      fetch("/api/catfish/hatchery/spawning"),
    ]);
    const transferPayload = await transferRes.json().catch(() => ({}));
    const eventPayload = await eventRes.json().catch(() => ({}));

    if (!transferRes.ok) {
      toast({ title: "Error", description: transferPayload.error || "Failed to load fry transfers", variant: "destructive" });
      setRows([]);
    } else {
      setRows(transferPayload.transfers || []);
    }

    if (eventRes.ok) {
      setEvents(eventPayload.events || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableEvents = useMemo(
    () => events.filter((event) => event.status !== "Failed"),
    [events]
  );

  const colDefs = useMemo<ColDef<FryTransfer>[]>(() => ([
    {
      field: "transferDate",
      headerName: "Transfer Date",
      minWidth: 130,
      valueFormatter: (params) =>
        params.value
          ? new Date(String(params.value)).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "-"
    },
    {
      field: "liveFryCount",
      headerName: "Live Fry",
      type: "numericColumn",
      minWidth: 120,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString()
    },
    {
      field: "internalPricePerFry",
      headerName: "Price / Fry (N)",
      type: "numericColumn",
      minWidth: 140,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: "sacrificedMaleWeightKg",
      headerName: "Male Wt (kg)",
      type: "numericColumn",
      minWidth: 130,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: "sacrificedMaleMeatPrice",
      headerName: "Male Meat Price (N)",
      type: "numericColumn",
      minWidth: 160,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: "totalTransferValue",
      headerName: "Transfer Value (N)",
      type: "numericColumn",
      minWidth: 160,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      cellStyle: { fontWeight: "700" }
    },
    {
      headerName: "Fingerlings Batch",
      minWidth: 180,
      valueGetter: (params) => params.data?.toBatch?.batchName || "-"
    }
  ]), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const response = await fetch("/api/catfish/hatchery/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spawningEventId: form.spawningEventId,
        transferDate: form.transferDate,
        liveFryCount: Number(form.liveFryCount || 0),
        internalPricePerFry: Number(form.internalPricePerFry || 0),
        sacrificedMaleMeatPrice: Number(form.sacrificedMaleMeatPrice || 0),
        notes: form.notes || null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: payload.error || "Failed to save fry transfer", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Fry transfer recorded and fingerlings batch created", variant: "success" });
      setOpen(false);
      setForm({
        spawningEventId: "",
        transferDate: new Date().toISOString().split("T")[0],
        liveFryCount: "",
        internalPricePerFry: "",
        sacrificedMaleMeatPrice: "",
        notes: "",
      });
      loadData();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="w-4 h-4 mr-2" />
              Add Fry Transfer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Fry Transfer</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label>Spawning Event</Label>
                <Select value={form.spawningEventId} onValueChange={(value) => setForm({ ...form, spawningEventId: value })}>
                  <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {new Date(event.eventDate).toLocaleDateString("en-GB").replace(/\//g, "-")} ({event.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Live Fry Count</Label><Input type="number" min="1" step="1" value={form.liveFryCount} onChange={(e) => setForm({ ...form, liveFryCount: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Internal Price / Fry</Label><Input type="number" min="0" step="0.01" value={form.internalPricePerFry} onChange={(e) => setForm({ ...form, internalPricePerFry: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Sacrificed Male Meat Price / kg</Label><Input type="number" min="0" step="0.01" value={form.sacrificedMaleMeatPrice} onChange={(e) => setForm({ ...form, sacrificedMaleMeatPrice: e.target.value })} required /></div>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="h-95 md:h-105 rounded-2xl border bg-white overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : (
          <AgGridReact
            suppressMovableColumns={typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches}
            theme={themeQuartz}
            rowData={rows}
            columnDefs={colDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              wrapHeaderText: true,
              autoHeaderHeight: true,
              minWidth: 120,
            }}
            overlayNoRowsTemplate="<span class='text-slate-500'>No fry transfers found</span>"
            pagination={true}
            paginationPageSize={20}
          />
        )}
      </div>
    </div>
  );
}
