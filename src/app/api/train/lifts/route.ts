import { getDb } from "@/lib/db";
import { handle, ok, queryDate } from "@/lib/api";
import { liftsList } from "@/lib/train/lifts";

export const GET = handle((req: Request) => ok(liftsList(getDb(), queryDate(req, "today"))));
