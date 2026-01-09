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
import { Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
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
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [recipeToDelete, setRecipeToDelete] = useState<RecipeRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Column Definitions: Defines the columns to be displayed.
    const colDefs = useMemo<ColDef<RecipeRow>[]>(() => {
        const columns: ColDef<RecipeRow>[] = [
            {
                field: "name",
                headerName: "Recipe Name",
                editable: isAdmin,
                flex: 1,
                minWidth: 200
            },
            {
                field: "targetBatchSize",
                headerName: "Batch Size (kg)",
                editable: isAdmin,
                filter: false,
                flex: 0.8,
                minWidth: 120,
                type: 'numericColumn',
                cellStyle: { textAlign: "center" },
                headerClass: "ag-center-header"
            }
        ];

        if (isAdmin) {
            columns.push({
                headerName: "Formula",
                filter: false,
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
                minWidth: 160
            });
        }

        columns.push({
            field: "isActive",
            headerName: "Active",
            editable: isAdmin,
            filter: false,
            width: 90,
            minWidth: 80,
            cellStyle: { textAlign: "center" },
            headerClass: "ag-center-header",
            cellRenderer: (params: any) => params.value ? '✅' : '❌'
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

    const onCellValueChanged = async (event: any) => {
        const updatedRow = event.data;
        const supabase = createClient();

        // Optimistic update handled by Grid, now save to DB
        const { error } = await supabase
            .from('Recipe')
            .upsert({
                id: updatedRow.id,
                name: updatedRow.name,
                description: updatedRow.description,
                targetBatchSize: updatedRow.targetBatchSize,
                isActive: updatedRow.isActive,
                updatedAt: new Date().toISOString()
            });

        if (error) {
            console.error("Error saving recipe:", error);
            alert("Failed to save changes: " + error.message);
        }
    };

    const onAddRow = async () => {
        // Create a new empty row in Supabase first (or local)
        const supabase = createClient();
        console.log("Attempting to create recipe...");
        const { data, error } = await supabase
            .from('Recipe')
            .insert({
                name: `New Recipe ${Math.floor(Math.random() * 10000)}`,
                targetBatchSize: 1000,
                isActive: true
            })
            .select()
            .single();

        if (data) {
            console.log("Recipe created:", data);
            setRowData([...rowData, data]);
        } else if (error) {
            console.error("Error creating recipe:", error);
            // Alert nicely
            alert(`Failed to create recipe: ${error.message || JSON.stringify(error)}`);
        }
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
            alert("Failed to delete recipe: " + error.message);
        } else {
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
            {isAdmin && (
                <div className="flex justify-end px-2">
                    <Button
                        onClick={onAddRow}
                        className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 px-6 mr-4"
                    >
                        <Plus className="w-4 h-4 " />
                        New Recipe
                    </Button>
                </div>
            )}
            <div className="ag-theme-quartz flex-1">
                <AgGridReact
                    rowData={rowData}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    rowSelection="single"
                    pagination={true}
                    onCellValueChanged={onCellValueChanged}
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
