import { z } from "zod";
import { getDb } from "@/lib/db";
import { createCustomFood, searchFoods } from "@/lib/foods";
import { handle, ok, parseBody } from "@/lib/api";

export const GET = handle((req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  return ok(q ? searchFoods(getDb(), q, 25) : []);
});

const customFoodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  servingLabel: z.string().trim().min(1).max(40),
  servingGrams: z.number().positive().max(5000),
  nutrients: z.record(z.string(), z.number().nonnegative()).refine((n) => n.kcal !== undefined, "kcal is required"),
});

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, customFoodSchema);
  return ok({ id: createCustomFood(getDb(), body) }, 201);
});
