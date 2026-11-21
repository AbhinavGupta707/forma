import { getDb } from "@/lib/db";
import { getFood } from "@/lib/foods";
import { fail, handle, ok, parseId } from "@/lib/api";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const food = getFood(getDb(), parseId((await ctx.params).id));
  return food ? ok(food) : fail(404, "Food not found");
});
