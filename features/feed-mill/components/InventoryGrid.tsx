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
import { toast } from "@/lib/toast";
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, ArrowUpRight } from 'lucide-react';
import { Ingredient } from '@/types';
import {
    calculateClosingBalance,
    calculateInventoryValue,
    calculateNewWeightedAveragePrice,
    calculateEntryTotal
} from '@/lib/calculations/inventory';
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

export function InventoryGrid() {
    const [rowData, setRowData] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddStock, setShowAddStock] = useState(false);

    // Add Stock Form State - Use strings to allow empty inputs
    const [selectedIngredient, setSelectedIngredient] = useState<string>("");
    const [quantity, setQuantity] = useState<string>("");
    const [unitCost, setUnitCost] = useState<string>("");
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

        // Closing Stock calculation: Opening + Purchased - Used
        const closingStock = calculateClosingBalance(
            Number(updatedRow.openingStock),
            Number(updatedRow.purchasedQuantity),
            Number(updatedRow.usedInProduction)
        );

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
            toast({
                title: "Error",
                description: "Failed to save ledger change: " + error.message,
                variant: "destructive"
            });
        } else {
            // Refresh data to ensure UI matches the true DB state
            loadData();
        }
    };

    // Grid Cols matching Excel Ledger
    const colDefs: ColDef<Ingredient>[] = [
        {
            field: "name" as const,
            headerName: "Item Name",
            flex: 1.5,
            filter: true,
            cellStyle: { fontWeight: '600', color: '#0f172a' }
        },
        {
            field: "openingStock" as const,
            headerName: "Opening (kg)",
            editable: true,
            type: 'numericColumn',
            flex: 1,
            filter: false,
            cellRenderer: (p: any) => Number(p.value || 0).toFixed(2)
        },
        {
            field: "purchasedQuantity" as const,
            headerName: "Purchased (kg)",
            editable: true,
            type: 'numericColumn',
            flex: 1,
            filter: false,
            cellRenderer: (p: any) => Number(p.value || 0).toFixed(2)
        },
        { 
            field: "usedInProduction" as const, 
            headerName: "Used (kg)", 
            editable: true, 
            type: 'numericColumn', 
            flex: 0.8,  
            filter: false, 
            cellRenderer: (p: any) => Number(p.value || 0).toFixed(2) 
        },
        {
            headerName: "Current Stock (kg)",
            field: "currentStock" as const, // SHOW THE TRUE DB STOCK
            type: 'numericColumn',
            flex: 1,
            cellStyle: { fontWeight: '700', color: '#10b981' },
            cellRenderer: (p: any) => Number(p.value || 0).toFixed(2),
            filter: false
        },
        {
            field: "averageCost" as const, headerName: "Price (₦/kg)", editable: true, type: 'numericColumn', flex: 1,
            filter: false,
            cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        {
            headerName: "Total Cost (₦)",
            type: 'numericColumn',
            flex: 1,
            valueGetter: (p: any) => calculateEntryTotal(Number(p.data.purchasedQuantity), Number(p.data.averageCost)),
            cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            filter: false
        },       
        
        {
            headerName: "Current Value (₦)",
            type: 'numericColumn',
            flex: 1.2,
            valueGetter: (p: any) => calculateInventoryValue(Number(p.data.currentStock), Number(p.data.averageCost)),
            cellRenderer: (p: any) => `${Number(p.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            filter: false
        },
        {
            field: "updatedAt" as const,
            headerName: "Last Updated",
            flex: 1,
            cellRenderer: (p: any) => <span className="text-slate-600 text-sm">{new Date(p.value).toLocaleDateString()}</span>,
            filter: false
        }
    ];

    const handleAddStock = async (e: React.FormEvent) => {
        e.preventDefault();
        const qtyNum = Number(quantity);
        if (!selectedIngredient || qtyNum <= 0 || Number(unitCost) < 0) return;
        setSubmitting(true);

        const supabase = createClient();
        const { data: currentItem, error: fetchError } = await supabase
            .from('Ingredient')
            .select('currentStock, averageCost, purchasedQuantity')
            .eq('id', selectedIngredient)
            .single();

        if (fetchError || !currentItem) {
            toast({ title: "Error", description: "Error fetching item details", variant: "destructive" });
            setSubmitting(false);
            return;
        }

        const oldStock = Number(currentItem.currentStock) || 0;
        const oldCost = Number(currentItem.averageCost) || 0;
        const oldPurchased = Number(currentItem.purchasedQuantity) || 0;
        const newQty = qtyNum;
        const newPrice = Number(unitCost);

        const totalQty = oldStock + newQty;
        const newAvgCost = calculateNewWeightedAveragePrice(oldStock, oldCost, newQty, newPrice);

        const { error: updateError } = await supabase.from('Ingredient').update({
            purchasedQuantity: oldPurchased + newQty,
            currentStock: totalQty,
            averageCost: newAvgCost,
            lastPurchasedPrice: newPrice,
            updatedAt: new Date().toISOString()
        }).eq('id', selectedIngredient);

        if (updateError) {
            toast({
                title: "Error",
                description: "Error updating stock: " + updateError.message,
                variant: "destructive"
            });
        } else {
            setShowAddStock(false);
            setQuantity("");
            setUnitCost("");
            setSelectedIngredient("");
            loadData();
        }
        setSubmitting(false);
    };


    if (loading && rowData.length === 0) return (
        <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-green-600 w-10 h-10" />
        </div>
    );

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex justify-end">
                <Dialog open={showAddStock} onOpenChange={setShowAddStock}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6 mr-4">
                            <Plus className="w-4 h-4 " />
                            Purchase Entry
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold tracking-tight">Record Purchase</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddStock} className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="ingredient">Select Ingredient</Label>
                                <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                                    <SelectTrigger className="w-full bg-slate-50/50 border-slate-200">
                                        <SelectValue placeholder="Choose item..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rowData.map(r => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="quantity">Quantity (kg)</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        step="0.01"
                                        value={quantity}
                                        className="bg-slate-50/50 border-slate-200"
                                        onChange={(e) => setQuantity(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cost">Unit Cost (/kg)</Label>
                                    <Input
                                        id="cost"
                                        type="number"
                                        step="0.01"
                                        value={unitCost}
                                        className="bg-slate-50/50 border-slate-200"
                                        onChange={(e) => setUnitCost(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center font-medium">
                                <span className="text-emerald-700 text-sm">Estimated Total:</span>
                                <span className="text-emerald-900 text-lg font-bold">{Number(calculateEntryTotal(Number(quantity), Number(unitCost))).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={submitting} className="w-full bg-emerald-700 hover:bg-emerald-800 py-6 text-base font-semibold transition-all">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
                                    Confirm Purchase
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



