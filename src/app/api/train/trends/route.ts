import { getDb } from "@/lib/db";
import { handle, ok, queryDate } from "@/lib/api";
import { trendsView } from "@/lib/train/views";

const ALLOWED = new Set([8, 12, 26, 52]);
const DEFAULT_WEEKS = 12;

export const GET = handle((req: Request) => {
  const n = Number(new URL(req.url).searchParams.get("weeks"));
  return ok(trendsView(getDb(), ALLOWED.has(n) ? n : DEFAULT_WEEKS, queryDate(req, "today")));
});
