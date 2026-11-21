import { getDb } from "@/lib/db";
import { handle, ok, queryDate } from "@/lib/api";
import { dayView } from "@/lib/train/views";

export const GET = handle((req: Request) => ok(dayView(getDb(), queryDate(req))));
