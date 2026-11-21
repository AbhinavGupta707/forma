import { getDb } from "@/lib/db";
import { handle, ok, queryDate } from "@/lib/api";
import { weekView } from "@/lib/train/views";

export const GET = handle((req: Request) => ok(weekView(getDb(), queryDate(req, "start"), queryDate(req, "today"))));
