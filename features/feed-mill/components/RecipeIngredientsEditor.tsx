"use client"

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Trash2, Save, Info } from "lucide-react";
import { Ingredient } from "@/types";
import { validateRecipePercentages, calculateBatchCost, calculateUnitCost } from "@/lib/calculations/recipe";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface EditorProps {
    recipeId: string;
    targetBatchSize: number;
}

interface RowItem {
    id?: string;
    ingredientId: string;
    percentage: string; // Use string for input handling
    ingredientName?: string;
    unitPrice?: number;
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
        setValidationError(null);
        const supabase = createClient();

        const { data: ingredients, error: ingError } = await supabase
            .from('Ingredient')
            .select('*')
            .order('name');

        if (ingError) setValidationError("Failed to load ingredients: " + ingError.message);
        if (ingredients) setAllIngredients(ingredients as any);

        const { data: items, error: itemError } = await supabase
            .from('RecipeItem')
            .select(`
        *,
        ingredient:Ingredient(name, unit, averageCost) 
      `)
            .eq('recipeId', recipeId);

        if (itemError) {
            console.error("Error loading recipe items:", itemError);
            setValidationError("Failed to load formula items.");
        }

        if (items) {
            const formatted: RowItem[] = items.map((item: any) => ({
                id: item.id,
                ingredientId: item.ingredientId,
                percentage: item.percentage.toString(),
                ingredientName: item.ingredient.name,
                unitPrice: item.ingredient.averageCost || 0
            }));
            setRows(formatted);
        }

        setLoading(false);
    };

    const handleAddRow = () => {
        setRows([...rows, { ingredientId: "", percentage: "0", unitPrice: 0 }]);
    };

    const handleRemoveRow = (index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        setRows(newRows);
    };

    const handleChange = (index: number, field: keyof RowItem, value: any) => {
        const newRows = [...rows];
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
            await supabase.from('RecipeItem').delete().eq('recipeId', recipeId);

            const toInsert = rows
                .filter(r => r.ingredientId && Number(r.percentage) > 0)
                .map(r => ({
                    recipeId,
                    ingredientId: r.ingredientId,
                    percentage: parseFloat(r.percentage)
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

    const calcItems = rows.map(r => ({ percentage: Number(r.percentage) || 0, averageCost: r.unitPrice || 0 }));
    const totalPercentage = rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);
    const totalCost = calculateBatchCost(calcItems, targetBatchSize);
    const costPerKg = calculateUnitCost(calcItems);

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-green-600 w-10 h-10" />
        </div>
    );

    const isPercentageBalanced = validateRecipePercentages(rows.map(r => ({ percentage: Number(r.percentage) || 0 })));

    return (
        <div className="space-y-6 custom-scrollbar">
            {validationError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm font-medium">
                    {validationError}
                </div>
            )}

            <Card className="border-none shadow-md overflow-hidden ">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[300px] ">Ingredient</TableHead>
                            <TableHead className="text-right ">Inclusion %</TableHead>
                            <TableHead className="text-right">Kg Required</TableHead>
                            <TableHead className="text-right">Unit Cost</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, idx) => {
                            const weight = (Number(row.percentage) / 100) * targetBatchSize;
                            const lineCost = weight * (row.unitPrice || 0);
                            return (
                                <TableRow key={idx} className="group">
                                    <TableCell>
                                        <Select
                                            value={row.ingredientId}
                                            onValueChange={(val) => handleChange(idx, 'ingredientId', val)}
                                        >
                                            <SelectTrigger className="w-full bg-white">
                                                <SelectValue placeholder="Select ingredient..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allIngredients.map(ing => (
                                                    <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            className="w-24 ml-auto text-right bg-white"
                                            value={row.percentage}
                                            onChange={(e) => handleChange(idx, 'percentage', e.target.value)}
                                            step="0.01"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-slate-600">
                                        {weight.toFixed(2)} kg
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-slate-500 text-xs">
                                        ₦{row.unitPrice?.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                        ₦{lineCost.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveRow(idx)}
                                            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                    <TableFooter className="bg-slate-50/50">
                        <TableRow>
                            <TableCell>
                                <Button variant="outline" size="sm" onClick={handleAddRow} className="text-green-700 hover:text-green-800 border-green-200 hover:bg-green-50">
                                    <Plus className="w-4 h-4 mr-2" /> Add Ingredient
                                </Button>
                            </TableCell>
                            <TableCell className={cn("text-right font-bold", isPercentageBalanced ? "text-green-600" : "text-destructive")}>
                                {totalPercentage.toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {(totalPercentage / 100 * targetBatchSize).toFixed(2)} kg
                            </TableCell>
                            <TableCell colSpan={2} className="text-right">
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 uppercase font-bold tracking-tight">Total Batch Cost</span>
                                    <span className="text-lg font-bold">₦{totalCost.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </Card>

            <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border">
                <div className="flex items-center text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Info className="w-4 h-4 mr-2 text-blue-500" />
                    Formula must sum to <span className="font-bold mx-1 text-slate-700">100%</span> to be valid.
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right mr-4">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Cost Per Kg</p>
                        <p className="text-xl font-bold text-green-700">₦{costPerKg.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !isPercentageBalanced}
                        className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 px-4 py-2 h-auto text-base font-semibold transition-all hover:scale-105 active:scale-95"
                    >
                        {saving ? <Loader2 className="w-5 h-5 mr-1 animate-spin" /> : <Save className="w-5 h-5 mr-1" />}
                        Save Formula
                    </Button>
                </div>
            </div>
        </div>
    )
}
