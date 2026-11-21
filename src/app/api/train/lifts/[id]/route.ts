import { getDb } from "@/lib/db";
import { handle, ok, parseId } from "@/lib/api";
import { liftDetail } from "@/lib/train/lifts";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => ok(liftDetail(getDb(), parseId((await ctx.params).id))));
