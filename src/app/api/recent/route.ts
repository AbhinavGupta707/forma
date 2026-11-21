import { getDb } from "@/lib/db";
import { recentItems } from "@/lib/log";
import { handle, ok } from "@/lib/api";

export const GET = handle(() => ok(recentItems(getDb())));
