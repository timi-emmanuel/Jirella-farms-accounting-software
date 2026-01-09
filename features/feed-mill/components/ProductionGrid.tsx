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
import { cn } from '@/lib/utils';
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

    // Fetch Recipes with ingredients, costs, and current stock levels
    const { data: recipeData } = await supabase
      .from('Recipe')
      .select('*, items:RecipeItem(percentage, ingredient:Ingredient(id, name, unit, averageCost, currentStock))')
      .eq('isActive', true)
      .order('name');

    if (logData) setRowData(logData as any);
    if (recipeData) setRecipes(recipeData as any);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when modal opens to ensure fresh stock levels
  useEffect(() => {
    if (showAddLog) {
      loadData();
    }
  }, [showAddLog]);

  const selectedRecipe = useMemo(() =>
    recipes.find(r => r.id === selectedRecipeId),
    [recipes, selectedRecipeId]
  );

  // Live Calculations & Validation
  const calculations = useMemo(() => {
    if (!selectedRecipe || !quantity || Number(quantity) <= 0) return null;

    const recipeItems = (selectedRecipe as any).items || (selectedRecipe as any).RecipeItem || [];
    if (!recipeItems || recipeItems.length === 0) return null;

    const baseCalcs = calculateProductionBatch(
      recipeItems.map((item: any) => ({
        id: item.ingredient?.id || '',
        name: item.ingredient?.name || 'Unknown',
        percentage: Number(item.percentage) || 0,
        averageCost: Number(item.ingredient?.averageCost) || 0
      })),
      Number(quantity)
    );

    if (!baseCalcs) return null;

    // Add availability info using precise ID matching
    const ingredientsWithValidation = baseCalcs.ingredientsNeeded.map((needed: any) => {
      const item = recipeItems.find((ri: any) => ri.ingredient?.id === needed.id);
      const available = Number(item?.ingredient?.currentStock) || 0;
      return {
        ...needed,
        available,
        isShort: available < needed.qty
      };
    });

    const hasShortage = ingredientsWithValidation.some(i => i.isShort);

    return {
      ...baseCalcs,
      ingredientsNeeded: ingredientsWithValidation,
      hasShortage
    };
  }, [selectedRecipe, quantity]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId || !quantity || Number(quantity) <= 0 || !calculations) return;
    setSubmitting(true);

    const supabase = createClient();

    // Use RPC for atomic transactional production
    const { error } = await supabase.rpc('handle_production', {
      p_recipe_id: selectedRecipeId,
      p_quantity_produced: Number(quantity),
      p_cost_per_kg: calculations.costPerKg,
      p_date: new Date().toISOString().split('T')[0]
    });

    if (error) {
      alert("Production Failed: " + error.message);
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
      minWidth: 120,
      filter: true
    },
    {
      field: "recipeId" as const,
      headerName: "Feed Type",
      flex: 1.5,
      minWidth: 180,
      filter: true,
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
      type: 'numericColumn',
      flex: 1,
      cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Cost/15kg Bag (₦)",
      type: 'numericColumn',
      flex: 1,
      valueGetter: (p: any) => p.data.cost15kg || calculateBagCost(Number(p.data.costPerKg), 15),
      cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Cost/25kg Bag (₦)",
      type: 'numericColumn',
      flex: 1,
      valueGetter: (p: any) => p.data.cost25kg || calculateBagCost(Number(p.data.costPerKg), 25),
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
            <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-6 mr-4">
              <Plus className="w-4 h-4 " />
              New Production Run
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto modal-scrollbar">
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
                    <div className="p-4 space-y-3">
                      {calculations.ingredientsNeeded.map((ing: any, idx: number) =>
                      (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-slate-600 font-medium">{ing.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Required:</span>
                              <span className="text-slate-900 font-bold">{ing.qty.toFixed(2)} kg</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] items-center">
                            <span className={ing.isShort ? "text-rose-500 font-bold" : "text-emerald-600 font-medium"}>
                              Available: {ing.available.toFixed(2)} kg
                            </span>
                            {ing.isShort && (
                              <span className="text-rose-600 font-black animate-pulse">
                                Short by {(ing.qty - ing.available).toFixed(2)} kg
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all duration-500",
                                ing.isShort ? "bg-rose-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min((ing.available / ing.qty) * 100, 100)}%` }}
                            />
                          </div>
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
              ) :
                (
                  <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-slate-400 italic text-sm">
                    {selectedRecipeId && quantity && Number(quantity) > 0
                      ? "No ingredients found for this recipe."
                      : "Select a recipe and enter quantity to see breakdown"}
                  </div>
                )}

              <DialogFooter>
                <div className="w-full flex flex-col gap-4">
                  {calculations?.hasShortage && (
                    <div className="w-full p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-3 text-rose-700 text-sm font-medium animate-in slide-in-from-bottom-2">
                      <Info className="w-4 h-4 text-rose-500 shrink-0" />
                      Cannot produce: Insufficient stock for some ingredients.
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || !calculations || calculations.hasShortage}
                    className={cn(
                      "w-full py-6 text-base font-semibold transition-all shadow-lg",
                      calculations?.hasShortage
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                        : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                    )}
                  >
                    {submitting
                      ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      : <Factory className="w-4 h-4 mr-2" />
                    }
                    Confirm Production
                  </Button>
                </div>
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
            filter: false,
            wrapHeaderText: true,
            autoHeaderHeight: true,
          }}
          pagination={true}
        />
      </div>
    </div>
  );
}
