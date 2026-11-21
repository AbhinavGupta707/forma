import { z } from "zod";
import { getDb } from "@/lib/db";
import { copyMeal } from "@/lib/log";
import { dateSchema, handle, mealSchema, ok, parseBody } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const b = await parseBody(req, z.object({ from: dateSchema, to: dateSchema, meal: mealSchema }));
  return ok({ copied: copyMeal(getDb(), b.from, b.to, b.meal) });
});
