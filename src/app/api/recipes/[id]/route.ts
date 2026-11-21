import { getDb } from "@/lib/db";
import { deleteRecipe, getRecipe, recipeSchema, saveRecipe } from "@/lib/recipes";
import { fail, handle, ok, parseBody, parseId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const r = getRecipe(getDb(), parseId((await ctx.params).id));
  return r ? ok(r) : fail(404, "Recipe not found");
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const id = parseId((await ctx.params).id);
  const db = getDb();
  if (!getRecipe(db, id)) return fail(404, "Recipe not found");
  saveRecipe(db, await parseBody(req, recipeSchema), id);
  return ok({ id });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteRecipe(getDb(), parseId((await ctx.params).id));
  return ok(null);
});
