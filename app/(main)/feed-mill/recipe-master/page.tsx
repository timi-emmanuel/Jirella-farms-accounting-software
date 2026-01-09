import { createClient } from "@/lib/supabase/server";
import { RecipeGrid } from "@/features/feed-mill/components/RecipeGrid";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";

export default async function RecipeMasterPage() {
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
     <p className="text-gray-500">Access to the Recipe Master is restricted to Administrators only.</p>
     <a href="/dashboard" className="text-blue-600 hover:underline block mt-4">
      ← Back to Dashboard
     </a>
    </div>
   </div>
  );
 }
 
 return (
  <div className="h-full flex flex-col space-y-4">

   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">Recipe Master</h1>
    <p className="text-sm text-gray-600 flex items-center">
     <span><Info className="w-4 h-4 mr-1" /></span>
     <span>Double click on a recipe to edit it</span>
    </p>
    
   </div>
   <p className="text-sm text-gray-600">Click on the "Formula" column to edit the ingredients</p>

   <div className="flex-1 overflow-hidden">
    <RecipeGrid />
   </div>
  </div>
 );
}
