import { getDb } from "@/lib/db";
import { deleteExercise } from "@/lib/log";
import { handle, ok, parseId } from "@/lib/api";

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  deleteExercise(getDb(), parseId((await ctx.params).id));
  return ok(null);
});
