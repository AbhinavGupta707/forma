import { getDb } from "@/lib/db";
import { getDay } from "@/lib/log";
import { handle, ok, queryDate } from "@/lib/api";

export const GET = handle((req: Request) => ok(getDay(getDb(), queryDate(req))));
