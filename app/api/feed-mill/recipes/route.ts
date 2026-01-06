
// app/api/feed-mill/recipes/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
 const supabase = await createClient();

 try {
  const { data: recipes, error } = await supabase
   .from('Recipe')
   .select(`
                *,
                items:RecipeItem (
                    *,
                    ingredient:Ingredient(*)
                )
            `);

  if (error) {
   console.error("Supabase error:", error);
   return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(recipes);
 } catch (error) {
  return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });
 }
}
