import { getDb } from "@/lib/db";
import { handle, ok, parseBody } from "@/lib/api";
import { createRoutine, listRoutines } from "@/lib/train/routines";
import { routineSchema } from "@/lib/train/schemas";

export const GET = handle(() => ok(listRoutines(getDb())));

export const POST = handle(async (req: Request) => ok({ id: createRoutine(getDb(), await parseBody(req, routineSchema)) }, 201));
