"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
// import "ag-grid-community/styles/ag-grid.css";
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
import { Loader2, Plus, FileSpreadsheet } from 'lucide-react';
import { Ingredient } from '@/types';
import { type } from 'os';

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

// Basic UI components if not available
const Card = ({ children, className }: any) => <div className={`bg-white rounded-lg border shadow-sm ${className}`}>{children}</div>;
const Input = (props: any) => <input {...props} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50" />;

const Label = ({ children }: any) => <label className="text-sm font-medium leading-none text-slate-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</label>;

export default function InventoryPage() {
 const [rowData, setRowData] = useState<Ingredient[]>([]);
 const [loading, setLoading] = useState(true);
 const [showAddStock, setShowAddStock] = useState(false);

 // Add Stock Form State
 const [selectedIngredient, setSelectedIngredient] = useState<string>("");
 const [quantity, setQuantity] = useState<number>(0);
 const [unitCost, setUnitCost] = useState<number>(0);
 const [submitting, setSubmitting] = useState(false);

 // Fetch Data
 const loadData = async () => {
  setLoading(true);
  const supabase = createClient();
  const { data, error } = await supabase.from('Ingredient').select('*').order('name');
  if (data) setRowData(data as any);
  setLoading(false);
 };

 useEffect(() => {
  loadData();
 }, []);

 // Handling inline ledger edits
 const onCellValueChanged = async (event: any) => {
  const updatedRow = event.data;
  const supabase = createClient();

  // Closing Stock calculation: (Opening + Purchased) - Used
  const closingStock = (Number(updatedRow.openingStock) || 0) + (Number(updatedRow.purchasedQuantity) || 0) - (Number(updatedRow.usedInProduction) || 0);

  const { error } = await supabase
   .from('Ingredient')
   .update({
    openingStock: Number(updatedRow.openingStock) || 0,
    purchasedQuantity: Number(updatedRow.purchasedQuantity) || 0,
    usedInProduction: Number(updatedRow.usedInProduction) || 0,
    averageCost: Number(updatedRow.averageCost) || 0,
    currentStock: closingStock,
    updatedAt: new Date().toISOString()
   })
   .eq('id', updatedRow.id);

  if (error) {
   alert("Failed to save ledger change: " + error.message);
  } else {
   // Optional: reload data to sync local display if needed, 
   // but AG Grid handles the numeric updates visually.
  }
 };

 // Grid Cols matching Excel Ledger
 const colDefs: ColDef<Ingredient>[] = [
  { 
   field: "name" as const,
   headerName: "Item Name",
   flex: 1.5,
   filter: false
  },
  {
   field: "openingStock" as const,
   headerName: "Opening Stock (kg)",
   editable: true,
   type: 'numericColumn',
   flex: 1,
   filter: false 
  },
  {
   field: "purchasedQuantity" as const,
   headerName: "Purchased Qty (kg)",
   editable: true,
   type: 'numericColumn',
   flex: 1,
   filter: false 
  },
  {
   field: "averageCost" as const,
   headerName: "Unit Price (₦/kg)",
   editable: true,
   type: 'numericColumn',
   flex: 1,
   filter:false,
   cellRenderer: (p: any) => `₦${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
  },
  {
   headerName: "Total Purchase Cost",
   type: 'numericColumn',
   flex: 1,
   filter: false,
   valueGetter: (p: any) => (Number(p.data.purchasedQuantity) || 0) * (Number(p.data.averageCost) || 0),
   cellRenderer: (p: any) => `₦${Number(p.value).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
  },
  { 
   field: "usedInProduction" as const,
   headerName: "Used (kg)",
   editable: true,
   type: 'numericColumn',
   flex: 0.8,
   filter: false 
  },
  {
   headerName: "Closing Stock (kg)",
   type: 'numericColumn',
   flex: 1,
   filter: false,
   cellStyle: { fontWeight: 'bold' },
   valueGetter: (p: any) => (Number(p.data.openingStock) || 0) + (Number(p.data.purchasedQuantity) || 0) - (Number(p.data.usedInProduction) || 0),
   cellRenderer: (p: any) => Number(p.value).toFixed(2)
  },
  {
   headerName: "Current Value",
   type: 'numericColumn',
   flex: 1.2,
   filter: false,
   valueGetter: (p: any) => ((Number(p.data.openingStock) || 0) + (Number(p.data.purchasedQuantity) || 0) - (Number(p.data.usedInProduction) || 0)) * (Number(p.data.averageCost) || 0),
   cellRenderer: (p: any) => `₦${Number(p.value).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
  },
  { 
   field: "updatedAt" as const,
   headerName: "Last Updated",
   flex: 1,
   filter: false,
   cellRenderer: (p: any) => new Date(p.value).toLocaleDateString()
  }
 ];

 // Handle Purchase Submit (Still keeping this as an optional way to add stock)
 const handleAddStock = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedIngredient || quantity <= 0 || unitCost < 0) return;
  setSubmitting(true);

  const supabase = createClient();

  // 1. Fetch current for calc
  const { data: currentItem, error: fetchError } = await supabase
   .from('Ingredient')
   .select('currentStock, averageCost, purchasedQuantity, openingStock, usedInProduction')
   .eq('id', selectedIngredient)
   .single();

  if (fetchError || !currentItem) {
   alert("Error fetching item details");
   setSubmitting(false);
   return;
  }

  const oldStock = Number(currentItem.currentStock) || 0;
  const oldCost = Number(currentItem.averageCost) || 0;
  const oldPurchased = Number(currentItem.purchasedQuantity) || 0;
  const newQty = Number(quantity);
  const newPrice = Number(unitCost);

  // Weighted Average Calculation
  const totalValue = (oldStock * oldCost) + (newQty * newPrice);
  const totalQty = oldStock + newQty;
  const newAvgCost = totalQty > 0 ? totalValue / totalQty : 0;

  // 3. Update Master
  const { error: updateError } = await supabase.from('Ingredient').update({
   purchasedQuantity: oldPurchased + newQty,
   currentStock: totalQty,
   averageCost: newAvgCost,
   lastPurchasedPrice: newPrice,
   updatedAt: new Date().toISOString()
  }).eq('id', selectedIngredient);

  if (updateError) {
   alert("Error updating stock: " + updateError.message);
  } else {
   setShowAddStock(false);
   setQuantity(0);
   setUnitCost(0);
   setSelectedIngredient("");
   loadData(); // Refresh grid
  }
  setSubmitting(false);
 };

 if (loading && rowData.length === 0) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <div>
     <h1 className="text-2xl font-bold tracking-tight">RM Inventory</h1>
     <p className="text-sm text-gray-400">double-click on a row to edit</p>
     <p className="text-gray-400 text-sm">Manage raw material ledger (Daily/Periodic Summary).</p>
    </div>
    
    <div className="flex space-x-2">
     <button
      onClick={() => setShowAddStock(true)}
      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center text-sm font-medium"
     >
      <Plus className="w-4 h-4 mr-2" />
      Purchase Entry
     </button>
    </div>
   </div>

   <div className="flex-1 border rounded-md overflow-hidden shadow-sm bg-white">
    <div className="h-full w-full">
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

   {/* Purchase Entry Modal */}
   {showAddStock && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
     <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
      <div className="flex justify-between items-center mb-4">
       <h2 className="text-lg font-bold text-slate-900">Record Purchase</h2>
       <button onClick={() => setShowAddStock(false)} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <form onSubmit={handleAddStock} className="space-y-4">
       <div className="space-y-2">
        <Label>Ingredient</Label>
        <select
         className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-green-500 focus:outline-none cursor-pointer"
         value={selectedIngredient}
         onChange={(e) => setSelectedIngredient(e.target.value)}
         required
        >
         <option value="">Select Item...</option>
         {rowData.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
       </div>

       <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
         <Label>Quantity (kg)</Label>
         <Input
          type="number"
          step="0.01"
          value={quantity}
          onChange={(e: any) => setQuantity(e.target.value)}
          required
         />
        </div>
        <div className="space-y-2">
         <Label>Unit Cost (₦/kg)</Label>
         <Input
          type="number"
          step="0.01"
          value={unitCost}
          onChange={(e: any) => setUnitCost(e.target.value)}
          required
         />
        </div>
       </div>

       <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 flex justify-between font-medium">
        <span>Total Cost:</span>
        <span>₦{Number(quantity * unitCost).toLocaleString()}</span>
       </div>

       <div className="pt-2 flex space-x-2 justify-end">
        <button
         type="button"
         onClick={() => setShowAddStock(false)}
         className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
        >
         Cancel
        </button>
        <button
         type="submit"
         disabled={submitting}
         className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-md disabled:opacity-50"
        >
         {submitting ? "Saving..." : "Save Purchase"}
        </button>
       </div>
      </form>
     </div>
    </div>
   )}
  </div>
 );
}
