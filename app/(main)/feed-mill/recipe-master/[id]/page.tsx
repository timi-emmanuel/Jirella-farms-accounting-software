
import { createClient } from "@/lib/supabase/server";
import { RecipeIngredientsEditor } from "@/features/feed-mill/components/RecipeIngredientsEditor";
import { notFound } from "next/navigation";

interface PageProps {
 params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: PageProps) {
 const { id } = await params;
 const supabase = await createClient();

 // Fetch Recipe details
 const { data: recipe, error } = await supabase
  .from("Recipe")
  .select("*")
  .eq("id", id)
  .single();

 if (error || !recipe) {
  notFound();
 }

 return (
  <div className="flex flex-col space-y-4 h-full">
   <div className="flex items-center justify-between border-b pb-4">
    <div>
     <h1 className="text-2xl font-bold tracking-tight">{recipe.name}</h1>
     <p className="text-muted-foreground">{recipe.description || "No description"}</p>
    </div>
    <div className="text-sm font-medium">
     Batch Size: <span className="font-mono">{recipe.targetBatchSize}kg</span>
    </div>
   </div>

   <div className="flex-1 overflow-auto">
    <RecipeIngredientsEditor recipeId={id} targetBatchSize={recipe.targetBatchSize} />
   </div>
  </div>
 );
}
