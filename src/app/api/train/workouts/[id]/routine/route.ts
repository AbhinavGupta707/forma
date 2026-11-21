import { z } from "zod";
import { getDb } from "@/lib/db";
import { handle, ok, parseBody, parseId } from "@/lib/api";
import { routineFromWorkout } from "@/lib/train/routines";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(1).max(80) }));
  return ok(routineFromWorkout(getDb(), parseId((await ctx.params).id), name), 201);
});
