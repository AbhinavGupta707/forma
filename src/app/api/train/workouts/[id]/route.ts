import { getDb } from "@/lib/db";
import { handle, ok, parseBody, parseId } from "@/lib/api";
import { currentBodyKg, type MovementContext, movementContext } from "@/lib/train/history";
import { workoutSchema } from "@/lib/train/schemas";
import { deleteWorkout, getWorkout, saveWorkout } from "@/lib/train/workouts";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const db = getDb();
  const id = parseId((await ctx.params).id);
  const workout = getWorkout(db, id);
  const contexts: Record<number, MovementContext> = {};
  for (const i of workout.items) contexts[i.movement.id] = movementContext(db, i.movement.id, id);
  return ok({ workout, contexts, bodyKg: currentBodyKg(db) });
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  saveWorkout(getDb(), parseId((await ctx.params).id), await parseBody(req, workoutSchema));
  return ok(null);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  deleteWorkout(getDb(), parseId((await ctx.params).id));
  return ok(null);
});
