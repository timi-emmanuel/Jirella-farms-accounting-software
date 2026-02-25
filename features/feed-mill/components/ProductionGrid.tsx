"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  ColDef,
  type ICellRendererParams,
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
import { toast } from "@/lib/toast";
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, Factory, Info, Wallet, RotateCcw } from 'lucide-react';
import { Recipe, ProductionLog } from '@/types';
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
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [balanceMap, setBalanceMap] = useState<Record<string, { qty: number; avgCost: number }>>({});

  // Form state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [bagSizeKg, setBagSizeKg] = useState<string>("");
  const [bagsProduced, setBagsProduced] = useState<string>("");
  const isoToday = new Date().toISOString().split('T')[0];
  const [producedAtISO, setProducedAtISO] = useState<string>(isoToday);
  const [producedAtDisplay, setProducedAtDisplay] = useState<string>(() => {
    const d = new Date().toISOString().split('T')[0];
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y}`;
  });

  // Helpers: format ISO (YYYY-MM-DD or full ISO) to DD-MM-YYYY and parse back
  const formatToDisplay = (isoOrAny: string | undefined | null) => {
    if (!isoOrAny) return '';
    const raw = String(isoOrAny);
    // Accept YYYY-MM-DD or full ISO
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    try {
      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) return '';
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yy = parsed.getFullYear();
      return `${dd}-${mm}-${yy}`;
    } catch {
      return '';
    }
  };

  const parseDisplayToISO = (display: string) => {
    const m = String(display || '').trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!m) return '';
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`; // ISO (YYYY-MM-DD)
  };

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
      .select('*, items:RecipeItem(percentage, ingredient:Ingredient(id, name, unit, averageCost))')
      .eq('isActive', true)
      .order('name');

    if (logData) setRowData(logData as any);
    if (recipeData) setRecipes(recipeData as any);

    const { data: location } = await supabase
      .from('InventoryLocation')
      .select('id')
      .eq('code', 'FEED_MILL')
      .single();

    if (location) {
      const { data: balances } = await supabase
        .from('InventoryBalance')
        .select('itemId, quantityOnHand, averageUnitCost')
        .eq('locationId', location.id);

      const map: Record<string, { qty: number; avgCost: number }> = {};
      (balances || []).forEach((b: any) => {
        map[b.itemId] = {
          qty: Number(b.quantityOnHand || 0),
          avgCost: Number(b.averageUnitCost || 0)
        };
      });
      setBalanceMap(map);
    }
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

  const quantityKg = useMemo(() => {
    const size = Number(bagSizeKg);
    const bags = Number(bagsProduced);
    if (size > 0 && bags > 0) return size * bags;
    return Number(quantity);
  }, [bagSizeKg, bagsProduced, quantity]);

  // Live Calculations & Validation
  const calculations = useMemo(() => {
    if (!selectedRecipe || !quantityKg || Number(quantityKg) <= 0) return null;

    const recipeItems = (selectedRecipe as any).items || (selectedRecipe as any).RecipeItem || [];
    if (!recipeItems || recipeItems.length === 0) return null;

    const baseCalcs = calculateProductionBatch(
      recipeItems.map((item: any) => {
        const balance = balanceMap[item.ingredient?.id || ''];
        return {
          id: item.ingredient?.id || '',
          name: item.ingredient?.name || 'Unknown',
          percentage: Number(item.percentage) || 0,
          averageCost: Number(balance?.avgCost || 0)
        };
      }),
      Number(quantityKg)
    );

    if (!baseCalcs) return null;

    // Add availability info using precise ID matching
    const ingredientsWithValidation = baseCalcs.ingredientsNeeded.map((needed: any) => {
      const available = Number(balanceMap[needed.id]?.qty || 0);
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
  }, [selectedRecipe, quantityKg, balanceMap]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId || !quantityKg || Number(quantityKg) <= 0 || !calculations || !producedAtISO) return;
    setSubmitting(true);

    const response = await fetch('/api/production/feed-mill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: selectedRecipeId,
        quantityProduced: Number(quantityKg),
        costPerKg: calculations.costPerKg,
        producedAt: producedAtISO,
        bagSizeKg: bagSizeKg ? Number(bagSizeKg) : null,
        bagsProduced: bagsProduced ? Number(bagsProduced) : null
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      toast({
        title: "Error",
        description: "Production Failed: " + (payload.error || response.statusText),
        variant: "destructive"
      });
    } else {
      setShowAddLog(false);
      setQuantity("");
      setBagSizeKg("");
      setBagsProduced("");
      const newIso = new Date().toISOString().split('T')[0];
      setProducedAtISO(newIso);
      setProducedAtDisplay(formatToDisplay(newIso));
      setSelectedRecipeId("");
      loadData();
    }
    setSubmitting(false);
  };

  const handleUndo = async (row: ProductionLog) => {
    if (row.isUndone) return;
    const shouldContinue = window.confirm("Undo this production run? This will replenish used ingredients.");
    if (!shouldContinue) return;

    setUndoingId(row.id);
    const response = await fetch(`/api/production/feed-mill/${row.id}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Manual undo from production log actions' })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast({
        title: "Error",
        description: payload.error || "Failed to undo production run.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Production run undone and ingredients replenished.",
        variant: "success"
      });
      loadData();
    }
    setUndoingId(null);
  };

  const colDefs: ColDef<ProductionLog>[] = [
    {
      field: "date" as const,
      headerName: "Date Produced",
      flex: 1,
      minWidth: 120,
      filter: true,
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        return formatToDisplay(p.value);
      }
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
      cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      cellStyle: { fontWeight: 'bold' }
    },
    {
      field: "costPerKg" as const,
      headerName: "Cost/kg (₦)",
      type: 'numericColumn',
      flex: 1,
      cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Cost/15kg Bag (₦)",
      type: 'numericColumn',
      flex: 1,
      valueGetter: (p: any) => p.data.cost15kg || calculateBagCost(Number(p.data.costPerKg), 15),
      cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Cost/25kg Bag (₦)",
      type: 'numericColumn',
      flex: 1,
      valueGetter: (p: any) => p.data.cost25kg || calculateBagCost(Number(p.data.costPerKg), 25),
      cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      headerName: "Action",
      width: 130,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<ProductionLog>) => {
        const row = params.data;
        if (!row) return null;
        const isUndone = Boolean(row.isUndone);
        const isLoading = undoingId === row.id;

        return (
          <div className="flex items-center justify-center h-full">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUndone || isLoading}
              onClick={() => handleUndo(row)}
              className="h-7 px-2 text-xs"
              title={isUndone ? "Already undone" : "Undo production run"}
            >
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {isUndone ? 'Undone' : 'Undo'}
                </>
              )}
            </Button>
          </div>
        );
      }
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
            <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6 mr-4">
              <Plus className="w-4 h-4 " />
              New Production Run
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto modal-scrollbar">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">Log Production</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleProduce} className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="producedAt">Date Produced</Label>
                              <Input
                                id="producedAt"
                                type="text"
                                value={producedAtDisplay}
                                placeholder="dd-mm-yyyy"
                                className="bg-slate-50/50 border-slate-200"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setProducedAtDisplay(v);
                                  const iso = parseDisplayToISO(v);
                                  if (iso) setProducedAtISO(iso);
                                }}
                                required
                              />
                            </div>
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
                    disabled={Number(bagSizeKg) > 0 && Number(bagsProduced) > 0}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bagSize">Bag Size (optional)</Label>
                  <Select value={bagSizeKg} onValueChange={setBagSizeKg}>
                    <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
                      <SelectValue placeholder="Select bag size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15kg</SelectItem>
                      <SelectItem value="25">25kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bagsProduced">Bags Produced (optional)</Label>
                  <Input
                    id="bagsProduced"
                    type="number"
                    value={bagsProduced}
                    placeholder="e.g. 40"
                    className="bg-slate-50/50 border-slate-200"
                    onChange={(e) => setBagsProduced(e.target.value)}
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
                              <span className="text-slate-900 font-bold">{ing.qty.toFixed(3)} kg</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] items-center">
                            <span className={ing.isShort ? "text-rose-500 font-bold" : "text-emerald-600 font-medium"}>
                              Available: {ing.available.toFixed(3)} kg
                            </span>
                            {ing.isShort && (
                              <span className="text-rose-600 font-black animate-pulse">
                                Short by {(ing.qty - ing.available).toFixed(3)} kg
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
                        <p className="text-2xl font-black text-white">{calculations.totalCost.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Cost/kg</span>
                      <span className="text-base font-bold text-slate-900">{calculations.costPerKg.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">15kg Bag</span>
                      <span className="text-base font-bold text-emerald-900">{calculations.cost15kg.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col items-center">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">25kg Bag</span>
                      <span className="text-base font-bold text-emerald-900">{calculations.cost25kg.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                        : "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-200"
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



