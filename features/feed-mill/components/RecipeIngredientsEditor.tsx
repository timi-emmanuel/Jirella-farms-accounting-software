"use client"

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Trash2, Save, Info } from "lucide-react";
import { Ingredient } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface EditorProps {
    recipeId: string;
}

interface RowItem {
    id?: string;
    ingredientId: string;
    percentage: string; // Use string for input handling
}

export function RecipeIngredientsEditor({ recipeId }: EditorProps) {
    const [rows, setRows] = useState<RowItem[]>([]);
    const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showCreateIngredient, setShowCreateIngredient] = useState(false);
    const [creatingIngredient, setCreatingIngredient] = useState(false);
    const [ingredientForm, setIngredientForm] = useState({
        name: "",
        description: "",
        unit: "KG",
        trackInFeedMill: true
    });
    const unitOptions = ["KG", "TON", "LITER", "BAG", "CRATE", "PCS"];

    const loadIngredients = async () => {
        const supabase = createClient();
        const { data: ingredients, error: ingError } = await supabase
            .from('Ingredient')
            .select('*')
            .order('name');

        if (ingError) setValidationError("Failed to load ingredients: " + ingError.message);
        if (ingredients) setAllIngredients(ingredients as any);
    };

    const loadData = async () => {
        setValidationError(null);
        const supabase = createClient();

        await loadIngredients();

        const { data: items, error: itemError } = await supabase
            .from('RecipeItem')
            .select(`
        *,
        ingredient:Ingredient(name, unit) 
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
                percentage: item.percentage.toString()
            }));
            setRows(formatted);
        }

        setLoading(false);
    };

    const handleAddRow = () => {
        setRows([...rows, { ingredientId: "", percentage: "0" }]);
    };

    const handleRemoveRow = (index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        setRows(newRows);
    };

    const handleChange = (index: number, field: keyof RowItem, value: any) => {
        const newRows = [...rows];
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

    const handleCreateIngredient = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = ingredientForm.name.trim();
        if (!name) return;

        setCreatingIngredient(true);
        const supabase = createClient();
        const { error } = await supabase
            .from("Ingredient")
            .insert({
                name,
                description: ingredientForm.description.trim() || null,
                unit: ingredientForm.unit,
                trackInFeedMill: ingredientForm.trackInFeedMill
            });

        if (error) {
            setValidationError("Failed to create ingredient: " + error.message);
            setCreatingIngredient(false);
            return;
        }

        await loadIngredients();
        setIngredientForm({
            name: "",
            description: "",
            unit: "KG",
            trackInFeedMill: true
        });
        setShowCreateIngredient(false);
        setCreatingIngredient(false);
    };

    useEffect(() => {
        loadData();
    }, [recipeId]);

    const totalPercentage = rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-green-600 w-10 h-10" />
        </div>
    );

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
                            <TableHead className="w-75 ">Ingredient</TableHead>
                            <TableHead className="text-right ">Inclusion %</TableHead>
                            <TableHead className="w-12.5"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, idx) => {
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
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={handleAddRow} className="text-green-700 hover:text-green-800 border-green-200 hover:bg-green-50">
                                        <Plus className="w-4 h-4 mr-2" /> Add Ingredient
                                    </Button>
                                    <Dialog open={showCreateIngredient} onOpenChange={setShowCreateIngredient}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="text-blue-700 hover:text-blue-800 border-blue-200 hover:bg-blue-50">
                                                <Plus className="w-4 h-4 mr-2" /> New Ingredient
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-120">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-bold tracking-tight">Create Ingredient</DialogTitle>
                                            </DialogHeader>
                                            <form onSubmit={handleCreateIngredient} className="space-y-4 py-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="ingredientName">Ingredient Name</Label>
                                                    <Input
                                                        id="ingredientName"
                                                        value={ingredientForm.name}
                                                        onChange={(e) => setIngredientForm(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="e.g. Maize"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="ingredientUnit">Unit</Label>
                                                    <Select
                                                        value={ingredientForm.unit}
                                                        onValueChange={(value) => setIngredientForm(prev => ({ ...prev, unit: value }))}
                                                    >
                                                        <SelectTrigger id="ingredientUnit">
                                                            <SelectValue placeholder="Select unit" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {unitOptions.map((unit) => (
                                                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="ingredientDescription">Description</Label>
                                                    <Textarea
                                                        id="ingredientDescription"
                                                        value={ingredientForm.description}
                                                        onChange={(e) => setIngredientForm(prev => ({ ...prev, description: e.target.value }))}
                                                        placeholder="Optional description"
                                                        rows={3}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id="trackInFeedMill"
                                                        type="checkbox"
                                                        checked={ingredientForm.trackInFeedMill}
                                                        onChange={(e) => setIngredientForm(prev => ({ ...prev, trackInFeedMill: e.target.checked }))}
                                                    />
                                                    <Label htmlFor="trackInFeedMill">Show in Feed Mill inventory</Label>
                                                </div>
                                                <DialogFooter>
                                                    <Button type="submit" disabled={creatingIngredient} className="bg-blue-600 hover:bg-blue-700">
                                                        {creatingIngredient ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                                        Create Ingredient
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-700">
                                {totalPercentage.toFixed(2)}%
                            </TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </Card>

            <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border">
                <div className="flex items-center text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Info className="w-4 h-4 mr-2 text-blue-500" />
                    Total inclusion is informational and can be above <span className="font-bold mx-1 text-slate-700">100%</span>.
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
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


