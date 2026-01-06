import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const INGREDIENTS = [
 "Maize", "Soya Meal", "BSF Cake", "BSF Lavae", "Wheat Offal",
 "Limestone/Calc", "Oil/Fat", "Binder", "Rice Bran", "PKC",
 "GNC", "Salt", "Premix", "Dead BSF", "BSF shell",
 "Bone Meal", "Concentrate"
];

const RECIPES = [
 "Broiler Starter",
 "Broiler Grower",
 "Gunea Fowl",
 "Ducks",
 "Turkey Breeder",
 "Layer Starter Mash",
 "Layer Grower Mash",
 "Layer Finisher Mash",
 "Poultry Parent Stock",
 "Catfish 0.5MM",
 "Catfish 2MM",
 "Catfish 4MM",
 "Catfish 6MM",
 "Catfish 9MM Broodstock"
];

export async function GET() {
 const supabase = await createClient();
 const results = {
  ingredients: { inserted: 0, errors: [] as any[] },
  recipes: { inserted: 0, errors: [] as any[] }
 };

 // Seed Ingredients
 for (const name of INGREDIENTS) {
  // Check if exists
  const { data: existing } = await supabase.from('Ingredient').select('id').eq('name', name).single();
  if (!existing) {
   const { error } = await supabase.from('Ingredient').insert({
    name,
    unit: 'KG',
    description: 'Auto-seeded'
   });
   if (error) results.ingredients.errors.push({ name, error: error.message });
   else results.ingredients.inserted++;
  }
 }

 // Seed Recipes
 for (const name of RECIPES) {
  // Check if exists
  const { data: existing } = await supabase.from('Recipe').select('id').eq('name', name).single();
  if (!existing) {
   const { error } = await supabase.from('Recipe').insert({
    name,
    targetBatchSize: 1000,
    isActive: true,
    description: 'Auto-seeded'
   });
   if (error) results.recipes.errors.push({ name, error: error.message });
   else results.recipes.inserted++;
  }
 }

 return NextResponse.json({
  message: "Seeding complete",
  results
 });
}
