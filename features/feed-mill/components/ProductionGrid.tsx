"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ColDef,
  ModuleRegistry,
  ClientSideRowModelModule,
  ValidationModule,
  RowSelectionModule,
  PaginationModule,
  RowStyleModule,
  CellStyleModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  TextEditorModule,
  NumberEditorModule,
  themeQuartz
} from 'ag-grid-community';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, Factory, Info, Wallet } from 'lucide-react';
import { Recipe, Ingredient, ProductionLog } from '@/types';
import {
  calculateProductionBatch,
  calculateBagCost,
  calculateBatchTotal
} from '@/lib/calculations/production';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Register AG Grid modules
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  RowSelectionModule,
  PaginationModule,
  RowStyleModule,
  CellStyleModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CustomFilterModule,
  TextEditorModule,
  NumberEditorModule
]);

export function ProductionGrid() {
  const [rowData, setRowData] = useState<ProductionLog[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLog, setShowAddLog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch Production Logs
    const { data: logData } = await supabase
      .from('ProductionLog')
      .select('*, recipe:Recipe(name)')
      .order('date', { ascending: false });

    // Fetch Recipes with ingredients and costs
    const { data: recipeData } = await supabase
      .from('Recipe')
      .select('*, items:RecipeItem(percentage, ingredient:Ingredient(name, unit, averageCost))')
      .eq('isActive', true)
      .order('name');

    if (logData) setRowData(logData as any);
    if (recipeData) setRecipes(recipeData as any);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedRecipe = useMemo(() =>
    recipes.find(r => r.id === selectedRecipeId),
    [recipes, selectedRecipeId]
  );

  // Live Calculations
  const calculations = useMemo(() => {
    if (!selectedRecipe || !quantity || Number(quantity) <= 0) return null;

    const recipeItems = (selectedRecipe as any).items || (selectedRecipe as any).RecipeItem || [];
    if (!recipeItems || recipeItems.length === 0) return null;

    return calculateProductionBatch(
      recipeItems.map((item: any) => ({
        name: item.ingredient?.name || 'Unknown',
        percentage: Number(item.percentage) || 0,
        averageCost: Number(item.ingredient?.averageCost) || 0
      })),
      Number(quantity)
    );
  }, [selectedRecipe, quantity]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId || !quantity || Number(quantity) <= 0 || !calculations) return;
    setSubmitting(true);

    const supabase = createClient();

    const { error } = await supabase.from('ProductionLog').insert([{
      recipeId: selectedRecipeId,
      quantityProduced: Number(quantity),
      costPerKg: calculations.costPerKg,
      date: new Date().toISOString().split('T')[0]
    }]);

    if (error) {
      alert("Error logging production: " + error.message);
    } else {
      setShowAddLog(false);
      setQuantity("");
      setSelectedRecipeId("");
      loadData();
    }
    setSubmitting(false);
  };

  const colDefs: ColDef<ProductionLog>[] = [
    {
      field: "date" as const,
      headerName: "Date",
      flex: 1,
      minWidth: 120
    },
    {
      field: "recipeId" as const,
      headerName: "Feed Type",
      flex: 1.5,
      minWidth: 180,
      valueFormatter: (p: any) => p.data.recipe?.name || 'Unknown',
      cellStyle: { fontWeight: '600', color: '#0f172a' }
    },
    {
      field: "quantityProduced" as const,
      headerName: "Qty Produced (kg)",
      type: 'numericColumn',
      flex: 1,
    },
    {
      headerName: "Total Batch Cost (₦)",
      type: 'numericColumn',
      flex: 1.2,
      valueGetter: (p: any) => calculateBatchTotal(Number(p.data.quantityProduced), Number(p.data.costPerKg)),
      cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      cellStyle: { fontWeight: 'bold' }
    },
    {
      field: "costPerKg" as const,
      headerName: "Cost/kg (₦)",
      type: 'numericColumn', flex: 1,
      cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Cost/15kg Bag (₦)",
      type: 'numericColumn',
      flex: 1,
      valueGetter: (p: any) => calculateBagCost(Number(p.data.costPerKg), 15),
      cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Cost/25kg Bag (₦)",
      type: 'numericColumn',
      flex: 1,
      valueGetter: (p: any) => calculateBagCost(Number(p.data.costPerKg), 25),
      cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    }
  ];

  if (loading && rowData.length === 0) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-green-600 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-end">
        <Dialog open={showAddLog} onOpenChange={setShowAddLog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-6">
              <Plus className="w-4 h-4 mr-2" />
              New Production Run
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log Production</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleProduce} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipe">Select Recipe</Label>
                  <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                    <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
                      <SelectValue placeholder="Choose recipe..." />
                    </SelectTrigger>
                    <SelectContent>
                      {recipes.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity to Produce (kg)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    placeholder="e.g. 1000"
                    className="bg-slate-50/50 border-slate-200"
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              {calculations ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Ingredient Breakdown */}
                  <div className="border rounded-xl bg-slate-50 overflow-hidden shadow-sm">
                    <div className="bg-slate-100 px-4 py-2 border-b flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                        <Info className="w-3.5 h-3.5 mr-1.5" />
                        Ingredient Requirements
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      {calculations.ingredientsNeeded.map((ing: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-200 last:border-0 hover:bg-slate-200/50 transition-colors">
                          <span className="text-slate-600 font-medium">{ing.name}</span>
                          <span className="text-slate-900 font-bold">{ing.qty.toFixed(2)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Headline */}
                  <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30">
                        <Wallet className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Production Cost</p>
                        <p className="text-2xl font-black text-white">₦{calculations.totalCost.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Cost/kg</span>
                      <span className="text-base font-bold text-slate-900">₦{calculations.costPerKg.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">15kg Bag</span>
                      <span className="text-base font-bold text-emerald-900">₦{calculations.cost15kg.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">25kg Bag</span>
                      <span className="text-base font-bold text-emerald-900">₦{calculations.cost25kg.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-slate-400 italic text-sm">
                  {selectedRecipeId && quantity && Number(quantity) > 0
                    ? "No ingredients found for this recipe."
                    : "Select a recipe and enter quantity to see breakdown"}
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={submitting || !calculations} className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-base font-semibold transition-all">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Factory className="w-4 h-4 mr-2" />}
                  Confirm Production
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
        />
      </div>
    </div>
  );
}
