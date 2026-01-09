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
 DateEditorModule,
 SelectEditorModule,
 themeQuartz
} from 'ag-grid-community';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, TrendingUp } from 'lucide-react';
import { FeedMillSale, Recipe } from '@/types';
import {
 calculateRevenue,
 calculateCOGS,
 calculateGrossProfit,
 calculateSaleMetrics
} from '@/lib/calculations/sales';
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
import { cn } from "@/lib/utils";

// Register AG Grid modules
ModuleRegistry.registerModules([
 ClientSideRowModelModule,
 ValidationModule,
 RowSelectionModule,
 PaginationModule,
 DateEditorModule,
 SelectEditorModule,
 RowStyleModule,
 CellStyleModule,
 TextFilterModule,
 NumberFilterModule,
 DateFilterModule,
 CustomFilterModule,
 TextEditorModule,
 NumberEditorModule
]);

export function SalesGrid() {
 const [rowData, setRowData] = useState<FeedMillSale[]>([]);
 const [recipes, setRecipes] = useState<Recipe[]>([]);
 const [loading, setLoading] = useState(true);
 const [showAddSale, setShowAddSale] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 // Form state for new sale - use strings for numeric inputs to handle empty state/deletion better
 const [newSale, setNewSale] = useState({
  recipeId: '',
  unitsSold: '',
  unitSellingPrice: '',
  unitCostPrice: '',
  date: new Date().toISOString().split('T')[0],
 });

 const loadData = async () => {
  setLoading(true);
  const supabase = createClient();

  // Fetch Sales
  const { data: salesData } = await supabase
   .from('FeedMillSale')
   .select('*, recipe:Recipe(name)')
   .order('date', { ascending: false });

  // Fetch Recipes for dropdown
  const { data: recipeData } = await supabase
   .from('Recipe')
   .select('id, name')
   .order('name');

  if (salesData) setRowData(salesData as any);
  if (recipeData) setRecipes(recipeData as any);
  setLoading(false);
 };

 useEffect(() => {
  loadData();
 }, []);

 const onCellValueChanged = async (event: any) => {
  const updatedRow = event.data;
  const supabase = createClient();

  const { error } = await supabase
   .from('FeedMillSale')
   .update({
    date: updatedRow.date,
    recipeId: updatedRow.recipeId,
    unitsSold: Number(updatedRow.unitsSold) || 0,
    unitSellingPrice: Number(updatedRow.unitSellingPrice) || 0,
    unitCostPrice: Number(updatedRow.unitCostPrice) || 0,
    updatedAt: new Date().toISOString()
   })
   .eq('id', updatedRow.id);

  if (error) {
   alert("Failed to save sale: " + error.message);
  } else {
   loadData(); // Re-fetch for calculated columns (COGS, Revenue etc from DB/Grid)
  }
 };

 const handleAddSale = async (e: React.FormEvent) => {
  e.preventDefault();
  const unitsSoldVal = Number(newSale.unitsSold);
  if (!newSale.recipeId || unitsSoldVal <= 0) return;
  setSubmitting(true);

  const supabase = createClient();

  // Prepare data for DB (convert strings to numbers)
  const saleToInsert = {
   ...newSale,
   unitsSold: unitsSoldVal,
   unitSellingPrice: Number(newSale.unitSellingPrice) || 0,
   unitCostPrice: Number(newSale.unitCostPrice) || 0,
  };

  const { error } = await supabase.from('FeedMillSale').insert([saleToInsert]);

  if (error) {
   alert("Error adding sale: " + error.message);
  } else {
   setShowAddSale(false);
   setNewSale({
    recipeId: '',
    unitsSold: '',
    unitSellingPrice: '',
    unitCostPrice: '',
    date: new Date().toISOString().split('T')[0]
   });
   loadData();
  }
  setSubmitting(false);
 };

 const colDefs: ColDef<FeedMillSale>[] = [
  {
   field: "date" as const,
   headerName: "Date",
   editable: false,
   flex: 1,
   minWidth: 120
  },
  {
   field: "recipeId" as const,
   headerName: "Product Name",
   editable: false,
   flex: 1.5,
   minWidth: 180,
   filter: false,
   valueFormatter: (p: any) => p.data.recipe?.name || 'Unknown Product',
   cellStyle: { fontWeight: '600', color: '#0f172a' },
   cellEditor: 'agSelectCellEditor',
   cellEditorParams: {
    values: recipes.map(r => r.id),
    formatValue: (id: string) => recipes.find(r => r.id === id)?.name || id
   }
  },
  {
   field: "unitsSold" as const,
   headerName: "Qty Sold (Bags)",
   editable: false,
   type: 'numericColumn',
   flex: 1,
   filter: false,
  },
  {
   field: "unitSellingPrice" as const,
   headerName: "S.P per Bag (₦)",
   editable: false,
   type: 'numericColumn', flex: 1,
   cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
   filter: false,
  },
  {
   field: "unitCostPrice" as const,
   headerName: "Cost per Bag (₦)",
   editable: false,
   type: 'numericColumn', flex: 1,
   cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
   filter: false,
  },
  {
   headerName: "Total Revenue",
   type: 'numericColumn',
   flex: 1,
   valueGetter: (p: any) => calculateRevenue(Number(p.data.unitsSold), Number(p.data.unitSellingPrice)),
   cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
   filter: false,
  },
  {
   headerName: "COGS",
   type: 'numericColumn',
   flex: 1,
   valueGetter: (p: any) => calculateCOGS(Number(p.data.unitsSold), Number(p.data.unitCostPrice)),
   cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
   filter: false,
  },
  {
   headerName: "Gross Profit",
   type: 'numericColumn',
   flex: 1,
   cellStyle: { fontWeight: '700' },
   valueGetter: (p: any) => {
    const rev = calculateRevenue(Number(p.data.unitsSold), Number(p.data.unitSellingPrice));
    const cogs = calculateCOGS(Number(p.data.unitsSold), Number(p.data.unitCostPrice));
    return calculateGrossProfit(rev, cogs);
   },
   cellRenderer: (p: any) => (
    <span className={p.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
     ₦{Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
   ),
   filter: false,
  }
 ];

 if (loading && rowData.length === 0) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-10 h-10 text-emerald-600" /></div>;

 const estRevenue = calculateRevenue(Number(newSale.unitsSold), Number(newSale.unitSellingPrice));
 const estProfit = calculateGrossProfit(estRevenue, calculateCOGS(Number(newSale.unitsSold), Number(newSale.unitCostPrice)));

 return (
  <div className="flex flex-col h-full space-y-4">
   <div className="flex justify-end">
    <Dialog open={showAddSale} onOpenChange={setShowAddSale}>
     <DialogTrigger asChild>
      <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-6 mr-4">
       <Plus className="w-4 h-4 " />
       Log New Sale
      </Button>
     </DialogTrigger>
     <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto modal-scrollbar">
      <DialogHeader>
       <DialogTitle className="text-xl font-bold tracking-tight">Log New Sale</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleAddSale} className="space-y-6 py-4">
       <div className="space-y-2">
        <Label htmlFor="date">Sale Date</Label>
        <Input
         id="date"
         type="date"
         value={newSale.date}
         className="bg-slate-50/50 border-slate-200"
         onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
         required
        />
       </div>

       <div className="space-y-2">
        <Label htmlFor="product">Product (Recipe)</Label>
        <Select value={newSale.recipeId} onValueChange={(val) => setNewSale({ ...newSale, recipeId: val })}>
         <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
          <SelectValue placeholder="Choose product..." />
         </SelectTrigger>
         <SelectContent>
          {recipes.map(r => (
           <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
          ))}
         </SelectContent>
        </Select>
       </div>

       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
         <Label htmlFor="unitsSold">Qty (Bags)</Label>
         <Input
          id="unitsSold"
          type="number"
          value={newSale.unitsSold}
          className="bg-slate-50/50 border-slate-200"
          onChange={(e) => setNewSale({ ...newSale, unitsSold: e.target.value })}
          required
         />
        </div>
        <div className="space-y-2">
         <Label htmlFor="sp">S.P (₦/Bag)</Label>
         <Input
          id="sp"
          type="number"
          value={newSale.unitSellingPrice}
          className="bg-slate-50/50 border-slate-200"
          onChange={(e) => setNewSale({ ...newSale, unitSellingPrice: e.target.value })}
          required
         />
        </div>
       </div>

       <div className="space-y-2">
        <Label htmlFor="cp">Cost Price (₦/Bag)</Label>
        <Input
         id="cp"
         type="number"
         value={newSale.unitCostPrice}
         className="bg-slate-50/50 border-slate-200"
         onChange={(e) => setNewSale({ ...newSale, unitCostPrice: e.target.value })}
         required
        />
       </div>

       <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
         <span className="text-slate-500">Revenue Outcome:</span>
         <span className="text-slate-900 font-bold text-base">₦{estRevenue.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between items-center text-sm font-medium">
         <span className="text-slate-500">Profit Projection:</span>
         <span className={cn("font-bold text-lg", estProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
          ₦{estProfit.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
         </span>
        </div>
       </div>

       <DialogFooter>
        <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-base font-semibold transition-all">
         {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
         Finalize Sale
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
     onCellValueChanged={onCellValueChanged}
    />
   </div>
  </div>
 );
}
