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
import { Loader2 } from 'lucide-react';
import { calculateBatchCost } from '@/lib/calculations/recipe';

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
    const [rowData, setRowData] = useState<RecipeRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Column Definitions: Defines the columns to be displayed.
    const [colDefs, setColDefs] = useState<ColDef<RecipeRow>[]>([
        {
            field: "name",
            headerName: "Recipe Name",
            editable: true,
            flex: 1,
            minWidth: 200
        },
        // { 
        //  field: "description",
        //  headerName: "Description", 
        //  editable: true, 
        //  flex: 2,
        //  minWidth: 250 
        // },
        {
            field: "targetBatchSize",
            headerName: "Batch Size (kg)",
            editable: true,
            filter: false,
            flex: 0.8,
            minWidth: 120,
            type: 'numericColumn',
            cellStyle: { textAlign: "center" },
            headerClass: "ag-center-header"
        },
        {
            headerName: "Total Batch Cost",
            type: 'numericColumn',
            flex: 1,
            minWidth: 150,
            cellStyle: { fontWeight: 'bold' },
            valueGetter: (params: any) => {
                const row = params.data as RecipeRow;
                if (!row.items || row.items.length === 0) return 0;

                return calculateBatchCost(
                    row.items.map(item => ({
                        percentage: item.percentage,
                        averageCost: item.ingredient?.averageCost || 0
                    })),
                    row.targetBatchSize || 0
                );
            },
            cellRenderer: (params: any) => `₦${Number(params.value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        {
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
        },
        {
            field: "isActive",
            headerName: "Active",
            editable: true,
            filter: false,
            width: 90,
            minWidth: 80,
            cellStyle: { textAlign: "center" },
            headerClass: "ag-center-header",
            cellRenderer: (params: any) => params.value ? '✅' : '❌'
        }
    ]);

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
            <div className="flex justify-end px-2">
                <button
                    onClick={onAddRow}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm transition"
                >
                    + New Recipe
                </button>
            </div>
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
        </div>
    );
}
