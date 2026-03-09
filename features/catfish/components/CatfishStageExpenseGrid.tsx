"use client";

import { useEffect, useState } from "react";
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
import { toast } from "@/lib/toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface CatfishModuleExpense {
  id: string;
  batchId?: string | null;
  batchName: string;
  stage?: string | null;
  expenseDate: string;
  description: string;
  amount: number;
  createdAt: string;
}

type BatchOption = { id: string; name: string };

export type CatfishStage = "hatchery" | "fingerlings" | "juvenile" | "growout";

const stageMapping: Record<CatfishStage, string> = {
  hatchery: "Hatchery",
  fingerlings: "Fingerlings",
  juvenile: "Juvenile",
  growout: "Grow-out (Adult)"
};

interface CatfishStageExpenseGridProps {
  stage: CatfishStage;
}

export function CatfishStageExpenseGrid({ stage }: CatfishStageExpenseGridProps) {
  const [rowData, setRowData] = useState<CatfishModuleExpense[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    batchId: "",
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0]
  });

  const stageLabel = stageMapping[stage];
  const isHatchery = stage === "hatchery";

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const response = await fetch(`/api/catfish/module-expenses?stage=${encodeURIComponent(stageLabel)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error(`Catfish ${stage} expense load error:`, payload.error || response.statusText);
        setRowData([]);
      } else {
        setRowData(payload.expenses || []);
      }
      setLoading(false);
    };

    const loadBatches = async () => {
      if (isHatchery) {
        setBatches([]);
        setForm((current) => ({ ...current, batchId: "" }));
        return;
      }

      const response = await fetch(`/api/catfish/batches?productionType=${encodeURIComponent(stageLabel)}`);
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.batches) {
        const nextBatches = (payload.batches as Array<{ id: string; batchName?: string }>).map((batch) => ({
          id: batch.id,
          name: batch.batchName || "Unknown"
        }));
        setBatches(nextBatches);
        setForm((current) => ({
          ...current,
          batchId: current.batchId || nextBatches[0]?.id || ""
        }));
      }
    };

    void loadData();
    void loadBatches();
  }, [isHatchery, stage, stageLabel]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!isHatchery && !form.batchId) || !form.description || Number(form.amount) <= 0) {
      toast({ description: "Please fill all fields with valid amounts", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const response = await fetch("/api/catfish/module-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: isHatchery ? null : form.batchId,
        stage: stageLabel,
        expenseDate: form.expenseDate,
        description: form.description,
        amount: parseFloat(form.amount)
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast({ description: payload.error || "Failed to add expense", variant: "destructive" });
    } else {
      toast({ description: "Expense added successfully", variant: "success" });
      setForm({
        batchId: isHatchery ? "" : (batches[0]?.id || ""),
        description: "",
        amount: "",
        expenseDate: new Date().toISOString().split("T")[0]
      });
      setShowAdd(false);
      const refresh = await fetch(`/api/catfish/module-expenses?stage=${encodeURIComponent(stageLabel)}`);
      const refreshPayload = await refresh.json().catch(() => ({}));
      setRowData(refresh.ok ? (refreshPayload.expenses || []) : []);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const response = await fetch(`/api/catfish/module-expenses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast({ description: "Failed to delete expense", variant: "destructive" });
      return;
    }

    toast({ description: "Expense deleted", variant: "success" });
    setRowData((current) => current.filter((row) => row.id !== id));
  };

  const columns: ColDef<CatfishModuleExpense>[] = [
    {
      field: "batchName",
      headerName: "Batch",
      flex: 1,
      minWidth: 150,
      sortable: true,
      filter: "agTextColumnFilter"
    },
    {
      field: "expenseDate",
      headerName: "Date",
      flex: 1,
      minWidth: 120,
      sortable: true,
      filter: "agDateColumnFilter"
    },
    {
      field: "description",
      headerName: "Description",
      flex: 2,
      minWidth: 200,
      sortable: true,
      filter: "agTextColumnFilter"
    },
    {
      field: "amount",
      headerName: "Amount (₦)",
      flex: 1,
      minWidth: 120,
      sortable: true,
      filter: "agNumberColumnFilter",
      cellDataType: "number",
      valueFormatter: ({ value }) =>
        `₦ ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    },
    {
      field: "id",
      headerName: "Actions",
      flex: 0.8,
      minWidth: 100,
      sortable: false,
      filter: false,
      cellRenderer: ({ value }: { value?: string }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => value && handleDelete(value)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Log {stageLabel} External Expenses</h2>
          <p className="text-sm text-slate-500">Record external costs (labor, meds, utilities, etc.) to improve batch P&L accuracy.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {stageLabel} Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              {!isHatchery ? (
                <div>
                  <Label htmlFor="batch-select">Batch</Label>
                  <Select value={form.batchId} onValueChange={(value) => setForm((current) => ({ ...current, batchId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  This expense will be recorded against hatchery operations.
                </div>
              )}
              <div>
                <Label htmlFor="expense-date">Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((current) => ({ ...current, expenseDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="e.g., Labor cost, Medication, Utilities..."
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {submitting ? "Adding..." : "Add Expense"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 border rounded-xl overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : rowData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            No expenses logged yet for {stageLabel.toLowerCase()}
          </div>
        ) : (
          <AgGridReact
            rowData={rowData}
            columnDefs={columns}
            theme={themeQuartz}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50]}
            domLayout="autoHeight"
            suppressHorizontalScroll={false}
          />
        )}
      </div>
    </div>
  );
}
