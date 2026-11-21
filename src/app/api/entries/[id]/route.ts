import { z } from "zod";
import { getDb } from "@/lib/db";
import { deleteEntry, updateEntry } from "@/lib/log";
import { handle, mealSchema, ok, parseBody, parseId } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  grams: z.number().positive().max(10000).optional(),
  servings: z.number().positive().max(50).optional(),
  meal: mealSchema.optional(),
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  updateEntry(getDb(), parseId((await ctx.params).id), await parseBody(req, patchSchema));
  return ok(null);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteEntry(getDb(), parseId((await ctx.params).id));
  return ok(null);
});
