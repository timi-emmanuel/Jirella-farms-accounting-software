"use client"

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Ingredient, RecipeItem } from "@/types";
import { cn } from "@/lib/utils";

interface EditorProps {
    recipeId: string;
    targetBatchSize: number;
}

interface RowItem {
    id?: string; // RecipeItem ID (if exists)
    ingredientId: string;
    percentage: number;
    // Computed for display
    ingredientName?: string;
    unitPrice?: number; // From Ingredient master
}

export function RecipeIngredientsEditor({ recipeId, targetBatchSize }: EditorProps) {
    const [rows, setRows] = useState<RowItem[]>([]);
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, [recipeId]);

    const loadData = async () => {
        // Clear previous errors
        setValidationError(null);
        const supabase = createClient();

        // 1. Fetch all ingredients for the dropdown
        const { data: ingredients, error: ingError } = await supabase
            .from('Ingredient')
            .select('*')
            .order('name');

        if (ingError) setValidationError("Failed to load ingredients: " + ingError.message);
        if (ingredients) setAllIngredients(ingredients as any);

        // 2. Fetch existing recipe items
        const { data: items, error: itemError } = await supabase
            .from('RecipeItem')
            .select(`
                *,
                ingredient:Ingredient(name, unit, averageCost) 
            `)
            .eq('recipeId', recipeId);

        if (itemError) {
            console.error("Error loading recipe items:", itemError);
            // If column averageCost is missing (likely), warn user but don't block entirely if possible
            // Actually, if fetching fails, items is null, so we must show error.
            setValidationError("Failed to load ingredients. DB Error: " + itemError.message);
        }

        if (items) {
            const formatted: RowItem[] = items.map((item: any) => ({
                id: item.id,
                ingredientId: item.ingredientId,
                percentage: item.percentage,
                ingredientName: item.ingredient.name,
                unitPrice: item.ingredient.averageCost || 0
            }));
            setRows(formatted);
        }

        setLoading(false);
    };

    const handleAddRow = () => {
        setRows([...rows, { ingredientId: "", percentage: 0, unitPrice: 0 }]);
    };

    const handleRemoveRow = (index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        setRows(newRows);
    };

    const handleChange = (index: number, field: keyof RowItem, value: any) => {
        const newRows = [...rows];
        // If changing ingredient, update unitPrice too
        if (field === 'ingredientId') {
            const ing = allIngredients.find(i => i.id === value);
            if (ing) {
                newRows[index].unitPrice = ing.averageCost || 0;
            }
        }
        newRows[index] = { ...newRows[index], [field]: value };
        setRows(newRows);
    };

    const handleSave = async () => {
        setSaving(true);
        setValidationError(null);
        const supabase = createClient();

        try {
            // 1. Delete all existing items for this recipe
            await supabase.from('RecipeItem').delete().eq('recipeId', recipeId);

            // 2. Insert new items
            const toInsert = rows
                .filter(r => r.ingredientId && r.percentage > 0)
                .map(r => ({
                    recipeId,
                    ingredientId: r.ingredientId,
                    percentage: parseFloat(r.percentage.toString())
                }));

            const { error } = await supabase.from('RecipeItem').insert(toInsert);

            if (error) {
                setValidationError(error.message);
            } else {
                loadData();
            }
        } catch (e: any) {
            setValidationError(e.message || "An unexpected error occurred");
        }
        setSaving(false);
    };

    // Calculations
    const totalPercentage = rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);
    const totalWeight = (totalPercentage / 100) * targetBatchSize;
    const totalCost = rows.reduce((sum, r) => {
        const weight = (r.percentage / 100) * targetBatchSize;
        return sum + (weight * (r.unitPrice || 0));
    }, 0);
    const costPerKg = targetBatchSize > 0 ? totalCost / targetBatchSize : 0;

    if (loading) return <Loader2 className="animate-spin text-black text-center" />;

    return (
        <div className="space-y-6 max-w-4xl rounded-md">
            {validationError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                    <strong>Error:</strong> {validationError}
                </div>
            )}
            <div className="border rounded-md shadow-sm ">
                <table className="w-full text-sm text-left">
                    <thead className=" border-b">
                        <tr>
                            <th className="px-4 py-3 font-medium">Ingredient</th>
                            <th className="px-4 py-3 font-medium w-32">Inclusion %</th>
                            <th className="px-4 py-3 font-medium w-32">Kg Required</th>
                            <th className="px-4 py-3 font-medium w-32">Avg Cost/kg</th>
                            <th className="px-4 py-3 font-medium w-32">Total Cost</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>

                    <tbody className="divide-y">
                        {rows.map((row, idx) => {
                            const weight = (row.percentage / 100) * targetBatchSize;
                            const lineCost = weight * (row.unitPrice || 0);
                            return (
                                <tr key={idx} className="group hover:bg-slate-900 ">
                                    <td className="px-4 py-2">
                                        <select
                                            className="
                                                    w-full
                                                    rounded
                                                    border
                                                    border-slate-300
                                                    bg-slate-200
                                                    px-2
                                                    py-1
                                                    text-sm
                                                    text-slate-900
                                                    focus:outline-none
                                                    cursor-pointer
                                                    focus:ring-2
                                                    focus:ring-blue-500
                                                    focus:border-blue-500
                                                "
                                            value={row.ingredientId}
                                            onChange={(e) => handleChange(idx, 'ingredientId', e.target.value)}
                                        >
                                            <option value="">Select Ingredient...</option>
                                            {allIngredients.map(ing => (
                                                <option key={ing.id} value={ing.id}>{ing.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="number"
                                            className="w-full bg-transparent border rounded px-2 py-1 text-gray-300"
                                            value={row.percentage}
                                            onChange={(e) => handleChange(idx, 'percentage', e.target.value)}
                                            step="0.01"
                                        /> 
                                    </td>
                                    <td className="px-4 py-2 font-mono text-gray-300">
                                        {weight.toFixed(2)} kg
                                    </td>
                                    <td className="px-4 py-2 font-mono text-gray-300 text-xs">
                                        ₦{row.unitPrice?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-gray-300 font-bold">
                                        ₦{lineCost.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button
                                            onClick={() => handleRemoveRow(idx)}
                                            className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>

                    <tfoot className="font-medium">
                        <tr>
                            <td className="px-4 py-3">
                                <button onClick={handleAddRow} className="flex items-center text-green-500 hover:text-green-600 text-xs uppercase tracking-wider font-bold">
                                    <Plus className="w-4 h-4 mr-1" /> Add Ingredient
                                </button>
                            </td>
                            <td className={cn("px-4 py-3", Math.abs(totalPercentage - 100) > 0.1 ? "text-red-600" : "text-green-600")}>
                                {totalPercentage.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3">
                                {totalWeight.toFixed(2)} kg
                            </td>
                            <td className="px-4 py-3 text-right" colSpan={2}>
                                Batch: ₦{totalCost.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colSpan={3}></td>
                            <td className="px-4 py-2 text-right text-xs text-slate-900 uppercase tracking-widest font-bold" colSpan={2}>
                                Avg Cost per Kg: ₦{costPerKg.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex items-center justify-between bg-slate-100 p-3 rounded-md">
                <div className="text-sm text-slate-500">
                    <p>ℹ️ Percentages must sum to 100%.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Save className="w-4 h-4 mr-2" />
                        Save Formula
                    </button>
                    {validationError && <span className="text-xs text-red-500 max-w-xs text-right">{validationError}</span>}
                </div>
            </div>
        </div>
    )
}
