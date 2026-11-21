import { z } from "zod";
import { getDb } from "@/lib/db";
import { addEntries } from "@/lib/log";
import { dateSchema, handle, mealSchema, ok, parseBody } from "@/lib/api";

const base = { date: dateSchema, meal: mealSchema };
const entrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("food"), ...base, foodId: z.number().int().positive(), grams: z.number().positive().max(10000) }),
  z.object({ kind: z.literal("recipe"), ...base, recipeId: z.number().int().positive(), servings: z.number().positive().max(50) }),
  z.object({
    kind: z.literal("quick"), ...base, label: z.string().trim().min(1).max(120),
    nutrients: z.record(z.string(), z.number().nonnegative()),
  }),
]);

export const POST = handle(async (req: Request) => {
  const entries = await parseBody(req, z.array(entrySchema).min(1).max(50));
  return ok({ ids: addEntries(getDb(), entries) }, 201);
});
