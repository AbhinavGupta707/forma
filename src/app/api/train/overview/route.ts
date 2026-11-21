import { getDb } from "@/lib/db";
import { handle, ok, queryDate } from "@/lib/api";
import { overview } from "@/lib/train/views";

export const GET = handle((req: Request) => ok(overview(getDb(), queryDate(req), Date.now())));
