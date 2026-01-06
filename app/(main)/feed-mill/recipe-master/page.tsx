
import { RecipeGrid } from "@/features/feed-mill/components/RecipeGrid";

export default function RecipeMasterPage() {
 return (
  <div className="h-full flex flex-col space-y-4">
   <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold tracking-tight">Recipe Master</h1>
    <p className="text-sm text-gray-400">double-click on a row to edit</p>
   </div>
   <div className="flex-1 overflow-hidden">
    <RecipeGrid />
   </div>
  </div>
 );
}
