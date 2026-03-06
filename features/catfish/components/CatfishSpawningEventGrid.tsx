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
import { useUserRole } from "@/hooks/useUserRole";

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
  femalesStripped: number;
  hormoneCost: number;
  maleFishCost: number;
  sacrificedMaleWeightKg: number;
  status: "Incubating" | "Completed" | "Failed";
  notes?: string | null;
};

export function CatfishSpawningEventGrid() {
  const { role } = useUserRole();
  const canViewFinancials = role !== "CATFISH_STAFF";
  const [rows, setRows] = useState<SpawningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    eventDate: new Date().toISOString().split("T")[0],
    femalesStripped: "",
    hormoneCost: "",
    maleFishCost: "",
    sacrificedMaleWeightKg: "",
    status: "Incubating",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch("/api/catfish/hatchery/spawning");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: payload.error || "Failed to load spawning events", variant: "destructive" });
      setRows([]);
    } else {
      setRows(payload.events || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const response = await fetch("/api/catfish/hatchery/spawning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventDate: form.eventDate,
        femalesStripped: Number(form.femalesStripped || 0),
        hormoneCost: Number(form.hormoneCost || 0),
        maleFishCost: Number(form.maleFishCost || 0),
        sacrificedMaleWeightKg: Number(form.sacrificedMaleWeightKg || 0),
        status: form.status,
        notes: form.notes || null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: payload.error || "Failed to save event", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Spawning event created", variant: "success" });
      setOpen(false);
      loadData();
    }
    setSubmitting(false);
  };

  const updateStatus = async (id: string, status: SpawningEvent["status"]) => {
    setUpdatingId(id);
    const response = await fetch(`/api/catfish/hatchery/spawning?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: payload.error || "Failed to update status", variant: "destructive" });
    } else {
      loadData();
    }
    setUpdatingId(null);
  };

  const colDefs = useMemo<ColDef<SpawningEvent>[]>(() => {
    const cols: ColDef<SpawningEvent>[] = [
      {
        field: "eventDate",
        headerName: "Date",
        minWidth: 130,
        valueFormatter: (params) =>
          params.value
            ? new Date(String(params.value)).toLocaleDateString("en-GB").replace(/\//g, "-")
            : "-"
      },
      {
        field: "femalesStripped",
        headerName: "Females",
        type: "numericColumn",
        minWidth: 110,
        valueFormatter: (params) => Number(params.value || 0).toLocaleString()
      },
      {
        field: "sacrificedMaleWeightKg",
        headerName: "Male Wt (kg)",
        type: "numericColumn",
        minWidth: 130,
        valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 140,
        cellRenderer: (params: { value?: string }) => {
          const value = String(params.value || "Incubating");
          const className = value === "Completed"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : value === "Failed"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700";
          return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>{value}</span>;
        }
      },
      {
        headerName: "Actions",
        minWidth: 260,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data?: SpawningEvent }) => {
          const row = params.data;
          if (!row) return null;
          const isUpdating = updatingId === row.id;
          return (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={isUpdating} onClick={() => updateStatus(row.id, "Incubating")}>Incubating</Button>
              <Button size="sm" variant="outline" disabled={isUpdating} onClick={() => updateStatus(row.id, "Completed")}>Completed</Button>
              <Button size="sm" variant="outline" disabled={isUpdating} onClick={() => updateStatus(row.id, "Failed")}>Failed</Button>
            </div>
          );
        }
      }
    ];

    if (canViewFinancials) {
      cols.splice(2, 0,
        {
          field: "hormoneCost",
          headerName: "Hormone Cost (N)",
          type: "numericColumn",
          minWidth: 150,
          valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        },
        {
          field: "maleFishCost",
          headerName: "Male Cost (N)",
          type: "numericColumn",
          minWidth: 140,
          valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        }
      );
    }

    return cols;
  }, [updatingId, canViewFinancials]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="w-4 h-4 mr-2" />
              Add Spawning Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Spawning Event</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Females Stripped</Label><Input type="number" min="0" step="1" value={form.femalesStripped} onChange={(e) => setForm({ ...form, femalesStripped: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Hormone Cost</Label><Input type="number" min="0" step="0.01" value={form.hormoneCost} onChange={(e) => setForm({ ...form, hormoneCost: e.target.value })} /></div>
                <div className="space-y-1"><Label>Male Fish Cost</Label><Input type="number" min="0" step="0.01" value={form.maleFishCost} onChange={(e) => setForm({ ...form, maleFishCost: e.target.value })} /></div>
                <div className="space-y-1"><Label>Male Weight (kg)</Label><Input type="number" min="0" step="0.01" value={form.sacrificedMaleWeightKg} onChange={(e) => setForm({ ...form, sacrificedMaleWeightKg: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Incubating">Incubating</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="h-80 rounded-2xl border bg-white overflow-hidden">
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
            overlayNoRowsTemplate="<span class='text-slate-500'>No spawning events found</span>"
            pagination={true}
            paginationPageSize={20}
          />
        )}
      </div>
    </div>
  );
}
