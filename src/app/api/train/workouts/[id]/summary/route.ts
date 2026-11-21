import { getDb } from "@/lib/db";
import { handle, ok, parseId } from "@/lib/api";
import { workoutSummary } from "@/lib/train/views";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => ok(workoutSummary(getDb(), parseId((await ctx.params).id))));
