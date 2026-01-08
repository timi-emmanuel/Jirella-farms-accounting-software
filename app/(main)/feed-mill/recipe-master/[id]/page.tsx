
import { createClient } from "@/lib/supabase/server";
import { RecipeIngredientsEditor } from "@/features/feed-mill/components/RecipeIngredientsEditor";
import { notFound } from "next/navigation";

interface PageProps {
 params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: PageProps) {
 const { id } = await params;
 const supabase = await createClient();

 // 1. Get Auth User
 const { data: { user } } = await supabase.auth.getUser();

 if (!user) {
  notFound();
 }

 // 2. Get Profile to check role
 const { data: profile } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single();

 if (!profile || profile.role !== 'ADMIN') {
  return (
   <div className="flex items-center justify-center h-full">
    <div className="text-center space-y-2">
     <h1 className="text-2xl font-bold text-gray-800">Permission Denied</h1>
     <p className="text-gray-500">Only administrators can view or edit recipe formulas.</p>
     <a href="/feed-mill/recipe-master" className="text-blue-600 hover:underline block mt-4">
      ← Back to Recipe Master
     </a>
    </div>
   </div>
  );
 }

 // 3. Fetch Recipe details
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
