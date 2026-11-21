import { z } from "zod";
import type { DB } from "./db";
import { getFood } from "./foods";
import { type Nutrients, scaleNutrients, sumNutrients } from "./nutrients";

export interface RecipeItem {
  foodId: number;
  foodName: string;
  grams: number;
  kcalPer100g: number;
}

export interface Recipe {
  id: number;
  name: string;
  aliases: string[];
  servings: number;
  notes: string | null;
  items: RecipeItem[];
  /** Nutrients for one serving. */
  perServing: Nutrients;
  /** Total grams in one serving. */
  servingGrams: number;
}

export const recipeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().trim().min(1).max(80)).max(10),
  servings: z.number().positive().max(100),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(z.object({ foodId: z.number().int().positive(), grams: z.number().positive().max(10000) })).min(1).max(60),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

interface RecipeRow {
  id: number;
  name: string;
  aliases: string;
  servings: number;
  notes: string | null;
}

function hydrate(db: DB, r: RecipeRow): Recipe {
  const rows = db
    .prepare("SELECT food_id AS foodId, grams FROM recipe_items WHERE recipe_id = ? ORDER BY id")
    .all(r.id) as { foodId: number; grams: number }[];
  const items: RecipeItem[] = [];
  const parts: Nutrients[] = [];
  for (const row of rows) {
    const food = getFood(db, row.foodId);
    if (!food) continue;
    items.push({ foodId: row.foodId, foodName: food.name, grams: row.grams, kcalPer100g: food.nutrients.kcal ?? 0 });
    parts.push(scaleNutrients(food.nutrients, row.grams));
  }
  const totalGrams = items.reduce((s, i) => s + i.grams, 0);
  return {
    id: r.id,
    name: r.name,
    aliases: JSON.parse(r.aliases) as string[],
    servings: r.servings,
    notes: r.notes,
    items,
    perServing: scaleNutrients(sumNutrients(parts), 100 / r.servings),
    servingGrams: totalGrams / r.servings,
  };
}

export function listRecipes(db: DB): Recipe[] {
  const rows = db.prepare("SELECT * FROM recipes ORDER BY name").all() as RecipeRow[];
  return rows.map((r) => hydrate(db, r));
}

export function getRecipe(db: DB, id: number): Recipe | null {
  const r = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as RecipeRow | undefined;
  return r ? hydrate(db, r) : null;
}

/** Find a recipe by name or alias, case-insensitive. */
export function findRecipeByName(db: DB, name: string): Recipe | null {
  const needle = name.trim().toLowerCase();
  return listRecipes(db).find((r) => [r.name, ...r.aliases].some((n) => n.toLowerCase() === needle)) ?? null;
}

export function saveRecipe(db: DB, input: RecipeInput, id?: number): number {
  return db.transaction(() => {
    const params = [input.name, JSON.stringify(input.aliases), input.servings, input.notes ?? null];
    let recipeId = id;
    if (recipeId === undefined) {
      recipeId = Number(
        db.prepare("INSERT INTO recipes (name, aliases, servings, notes) VALUES (?, ?, ?, ?)").run(...params)
          .lastInsertRowid,
      );
    } else {
      db.prepare("UPDATE recipes SET name = ?, aliases = ?, servings = ?, notes = ? WHERE id = ?").run(
        ...params,
        recipeId,
      );
      db.prepare("DELETE FROM recipe_items WHERE recipe_id = ?").run(recipeId);
    }
    const insert = db.prepare("INSERT INTO recipe_items (recipe_id, food_id, grams) VALUES (?, ?, ?)");
    for (const item of input.items) insert.run(recipeId, item.foodId, item.grams);
    return recipeId;
  })();
}

export function deleteRecipe(db: DB, id: number): void {
  db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
}
