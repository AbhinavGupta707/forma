import { getDb } from "@/lib/db";
import { handle, ok, parseId } from "@/lib/api";
import { movementContext } from "@/lib/train/history";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const w = new URL(req.url).searchParams.get("workoutId");
  return ok(movementContext(getDb(), parseId((await ctx.params).id), w ? parseId(w) : undefined));
});
