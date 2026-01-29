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
import { Loader2, Plus, Wallet } from 'lucide-react';
import { Expense } from '@/types';
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

export function PoultryExpenseGrid() {
  const [rowData, setRowData] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: '',
    amount: '',
    spentAt: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const response = await fetch('/api/expenses?module=POULTRY');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Expense load error:', payload.error || response.statusText);
    } else {
      setRowData(payload.expenses || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category || Number(form.amount) <= 0) return;
    setSubmitting(true);

    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'POULTRY',
        category: form.category,
        amount: Number(form.amount),
        spentAt: form.spentAt,
        notes: form.notes || null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: payload.error || 'Failed to log expense.',
        variant: "destructive"
      });
    } else {
      setShowAdd(false);
      setForm({
        category: '',
        amount: '',
        spentAt: new Date().toISOString().split('T')[0],
        notes: ''
      });
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs = useMemo<ColDef<Expense>[]>(() => [
    {
      field: "spentAt",
      headerName: "Date",
      minWidth: 140,
      valueFormatter: (p: any) => new Date(p.value).toLocaleDateString('en-GB').replace(/\//g, '-')
    },
    {
      field: "category",
      headerName: "Category",
      flex: 1.3,
      minWidth: 160,
      filter: true
    },
    {
      field: "amount",
      headerName: "Amount (₦)",
      type: 'numericColumn',
      minWidth: 150,
      valueFormatter: (p: any) => Number(p.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
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
              Log Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Log Poultry Expense
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="expenseDate">Date</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={form.spentAt}
                  onChange={(e) => setForm({ ...form, spentAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseCategory">Category</Label>
                <Input
                  id="expenseCategory"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Labor, vaccine, power, maintenance"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseAmount">Amount (₦)</Label>
                <Input
                  id="expenseAmount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseNotes">Notes</Label>
                <Textarea
                  id="expenseNotes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Expense
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



