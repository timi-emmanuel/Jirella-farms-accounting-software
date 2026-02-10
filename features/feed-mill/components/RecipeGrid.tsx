"use client"

import { useEffect, useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import "ag-grid-community/styles/ag-theme-quartz.css";
import { toast } from "@/lib/toast";
import {
    ColDef,
    ModuleRegistry,
    ClientSideRowModelModule,
    ValidationModule,
    RowSelectionModule,
    PaginationModule,
    RowStyleModule,
    TextFilterModule,
    NumberFilterModule,
    DateFilterModule,
    CustomFilterModule,
    TextEditorModule,
    NumberEditorModule,
    CellStyleModule,
    CheckboxEditorModule,
    themeQuartz
} from 'ag-grid-community';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Trash2, AlertTriangle, Plus, ArrowUpRight } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { logActivity } from '@/lib/logger';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Register modules
ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ValidationModule,
    RowSelectionModule,
    PaginationModule,
    RowStyleModule,
    TextFilterModule,
    NumberFilterModule,
    DateFilterModule,
    CustomFilterModule,
    TextEditorModule,
    NumberEditorModule,
    CellStyleModule,
    CheckboxEditorModule
]);



interface RecipeRow {
    id: string;
    name: string;
    description: string;
    targetBatchSize: number;
    isActive: boolean;
    items?: {
        percentage: number;
        ingredient: {
            averageCost: number;
        };
    }[];
}

export function RecipeGrid() {
    const { isAdmin } = useUserRole();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newProductName, setNewProductName] = useState("");
    const [newProductDescription, setNewProductDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [recipeToDelete, setRecipeToDelete] = useState<RecipeRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Column Definitions: Defines the columns to be displayed.
    const colDefs = useMemo<ColDef<RecipeRow>[]>(() => {
        const columns: ColDef<RecipeRow>[] = [
            {
                field: "name",
                headerName: "Product Name",
                flex: 1,
                minWidth: 200
            }
        ];

        columns.push({
                headerName: "Formula",
                filter: false,
                flex: 1,
                cellRenderer: (params: any) => {
                    return (
                        <a
                            href={`/feed-mill/recipe-master/${params.data.id}`}
                            className="text-blue-600 hover:underline text-sm font-medium"
                        >
                            Edit Ingredients →
                        </a>
                    );
                },
            
            });
        if (isAdmin) {
            columns.push({
                headerName: "Actions",
                width: 100,
                minWidth: 100,
                filter: false,
                sortable: false,
                cellRenderer: (params: any) => (
                    <div className="flex items-center justify-center h-full">
                        <button
                            onClick={() => {
                                setRecipeToDelete(params.data);
                                setDeleteDialogOpen(true);
                            }}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                            title="Delete Recipe"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )
            });
        }

        return columns;
    }, [isAdmin]);

    const [rowData, setRowData] = useState<RecipeRow[]>([]);
    const [loading, setLoading] = useState(true);

    const defaultColDef = useMemo(() => {
        return {
            filter: true,
            sortable: true,
        };
    }, []);

    const handleCreateProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newProductName.trim();
        if (!name) return;

        setIsCreating(true);
        const supabase = createClient();

        const { data, error } = await supabase
            .from('Recipe')
            .insert({
                name,
                description: newProductDescription.trim() || null,
                targetBatchSize: 100,
                isActive: true
            })
            .select('*, items:RecipeItem(percentage, ingredient:Ingredient(averageCost))')
            .single();

        if (error) {
            toast({
                title: "Error",
                description: "Failed to create product: " + error.message,
                variant: "destructive"
            });
            setIsCreating(false);
            return;
        }

        await logActivity(
            'RECIPE_CREATED',
            'Recipe',
            data.id,
            `Created recipe: ${data.name}`,
            { name: data.name },
            undefined
        );

        setRowData(prev => [...prev, data as RecipeRow].sort((a, b) => a.name.localeCompare(b.name)));
        setNewProductName("");
        setNewProductDescription("");
        setShowCreateDialog(false);
        setIsCreating(false);
    };

    const handleDelete = async () => {
        if (!recipeToDelete) return;
        setIsDeleting(true);
        const supabase = createClient();

        const { error } = await supabase
            .from('Recipe')
            .delete()
            .eq('id', recipeToDelete.id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete recipe: " + error.message,
                variant: "destructive"
            });
        } else {
            await logActivity('RECIPE_DELETED', 'Recipe', recipeToDelete.id, `Deleted recipe: ${recipeToDelete.name}`, { name: recipeToDelete.name }, undefined);
            setRowData(prev => prev.filter(r => r.id !== recipeToDelete.id));
            setDeleteDialogOpen(false);
            setRecipeToDelete(null);
        }
        setIsDeleting(false);
    };

    useEffect(() => {
        const fetchRecipes = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('Recipe')
                .select('*, items:RecipeItem(percentage, ingredient:Ingredient(averageCost))')
                .order('name');

            if (data) {
                setRowData(data);
            }
            setLoading(false);
        };

        fetchRecipes();
    }, []);



    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-green-600 w-10 h-10" />
        </div>
    );

    return (
        <div className="flex flex-col h-full space-y-2">
            <div className="flex justify-end">
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all hover:scale-105 active:scale-95 px-6 mr-2">
                            <Plus className="w-4 h-4 mr-1" />
                            New Product
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-106.25">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold tracking-tight">Create Product</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreateProduct} className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="productName">Product Name</Label>
                                <Input
                                    id="productName"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    placeholder="e.g. Grower Mash 25kg"
                                    className="bg-slate-50/50 border-slate-200"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="productDescription">Description</Label>
                                <Textarea
                                    id="productDescription"
                                    value={newProductDescription}
                                    onChange={(e) => setNewProductDescription(e.target.value)}
                                    placeholder="Enter a short product description"
                                    className="bg-slate-50/50 border-slate-200"
                                    rows={3}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating} className="w-full bg-emerald-700 hover:bg-emerald-800 py-6 text-base font-semibold transition-all">
                                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
                                    Create Product
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="ag-theme-quartz flex-1">
                <AgGridReact
                    rowData={rowData}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    rowSelection="single"
                    pagination={true}
                    rowStyle={{ cursor: 'pointer' }}
                    theme={themeQuartz} // Explicitly set theme to suppress warning, or use "legacy" string if preferred
                />
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center text-red-600">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Delete Recipe?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-bold text-slate-900">"{recipeToDelete?.name}"</span>?
                            This action cannot be undone and will remove all associated ingredient mappings.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 " />}
                            Delete Recipe
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}




