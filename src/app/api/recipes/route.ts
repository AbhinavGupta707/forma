import { getDb } from "@/lib/db";
import { listRecipes, recipeSchema, saveRecipe } from "@/lib/recipes";
import { handle, ok, parseBody } from "@/lib/api";

export const GET = handle(() => ok(listRecipes(getDb())));

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, recipeSchema);
  return ok({ id: saveRecipe(getDb(), body) }, 201);
});
