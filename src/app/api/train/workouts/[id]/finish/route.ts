import { getDb } from "@/lib/db";
import { handle, ok, parseBody, parseId } from "@/lib/api";
import { finishSchema } from "@/lib/train/schemas";
import { finishWorkout } from "@/lib/train/workouts";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) =>
  ok(finishWorkout(getDb(), parseId((await ctx.params).id), await parseBody(req, finishSchema))));
