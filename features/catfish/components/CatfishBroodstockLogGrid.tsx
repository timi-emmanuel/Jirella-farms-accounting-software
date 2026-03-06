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
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

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

type BroodstockLog = {
  id: string;
  logDate: string;
  feedBrand: string;
  feedAmountKg: number;
  feedUnitPrice: number;
  dailyFeedCost: number;
  mortalityCount: number;
  notes?: string | null;
};

export function CatfishBroodstockLogGrid() {
  const { role } = useUserRole();
  const canViewFinancials = role !== "CATFISH_STAFF";
  const [rows, setRows] = useState<BroodstockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    logDate: new Date().toISOString().split("T")[0],
    feedBrand: "",
    feedAmountKg: "",
    feedUnitPrice: "",
    mortalityCount: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch("/api/catfish/hatchery/broodstock");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: payload.error || "Failed to load broodstock logs", variant: "destructive" });
      setRows([]);
    } else {
      setRows(payload.logs || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const response = await fetch("/api/catfish/hatchery/broodstock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logDate: form.logDate,
        feedBrand: form.feedBrand,
        feedAmountKg: Number(form.feedAmountKg || 0),
        feedUnitPrice: canViewFinancials ? Number(form.feedUnitPrice || 0) : 0,
        mortalityCount: Number(form.mortalityCount || 0),
        notes: form.notes || null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ title: "Error", description: payload.error || "Failed to save log", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Broodstock log created", variant: "success" });
      setOpen(false);
      setForm({
        logDate: new Date().toISOString().split("T")[0],
        feedBrand: "",
        feedAmountKg: "",
        feedUnitPrice: "",
        mortalityCount: "",
        notes: "",
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<BroodstockLog>[]>(() => {
    const cols: ColDef<BroodstockLog>[] = [
    {
      field: "logDate",
      headerName: "Date",
      minWidth: 130,
      valueFormatter: (params) =>
        params.value
          ? new Date(String(params.value)).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "-"
    },
    { field: "feedBrand", headerName: "Feed Brand", minWidth: 180 },
    {
      field: "feedAmountKg",
      headerName: "Feed (kg)",
      type: "numericColumn",
      minWidth: 130,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
    {
      field: "mortalityCount",
      headerName: "Mortality",
      type: "numericColumn",
      minWidth: 120,
      valueFormatter: (params) => Number(params.value || 0).toLocaleString()
    },
    {
      field: "notes",
      headerName: "Notes",
      minWidth: 180,
      flex: 1
    }
  ];

    if (canViewFinancials) {
      cols.splice(3, 0,
        {
          field: "feedUnitPrice",
          headerName: "Unit Price (N)",
          type: "numericColumn",
          minWidth: 140,
          valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        },
        {
          field: "dailyFeedCost",
          headerName: "Feed Cost (N)",
          type: "numericColumn",
          minWidth: 140,
          valueFormatter: (params) => Number(params.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        }
      );
    }
    return cols;
  }, [canViewFinancials]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="w-4 h-4 mr-2" />
              Add Broodstock Log
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Broodstock Log</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={form.logDate} onChange={(e) => setForm({ ...form, logDate: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>Feed Brand</Label>
                  <Input value={form.feedBrand} onChange={(e) => setForm({ ...form, feedBrand: e.target.value })} />
                </div>
              </div>
              <div className={`grid gap-3 ${canViewFinancials ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="space-y-1">
                  <Label>Feed (kg)</Label>
                  <Input type="number" min="0" step="0.01" value={form.feedAmountKg} onChange={(e) => setForm({ ...form, feedAmountKg: e.target.value })} />
                </div>
                {canViewFinancials ? (
                  <div className="space-y-1">
                    <Label>Unit Price</Label>
                    <Input type="number" min="0" step="0.01" value={form.feedUnitPrice} onChange={(e) => setForm({ ...form, feedUnitPrice: e.target.value })} />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label>Mortality</Label>
                  <Input type="number" min="0" step="1" value={form.mortalityCount} onChange={(e) => setForm({ ...form, mortalityCount: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
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
            overlayNoRowsTemplate="<span class='text-slate-500'>No broodstock logs found</span>"
            pagination={true}
            paginationPageSize={20}
          />
        )}
      </div>
    </div>
  );
}
