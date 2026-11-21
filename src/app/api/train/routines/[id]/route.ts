import { getDb } from "@/lib/db";
import { handle, ok, parseBody, parseId } from "@/lib/api";
import { deleteRoutine, getRoutine, updateRoutine } from "@/lib/train/routines";
import { routineSchema } from "@/lib/train/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => ok(getRoutine(getDb(), parseId((await ctx.params).id))));

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  updateRoutine(getDb(), parseId((await ctx.params).id), await parseBody(req, routineSchema));
  return ok(null);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteRoutine(getDb(), parseId((await ctx.params).id));
  return ok(null);
});
