import { getDb } from "@/lib/db";
import { trends } from "@/lib/log";
import { fail, handle, ok, queryDate } from "@/lib/api";

const MAX_DAYS = 366;

export const GET = handle((req: Request) => {
  const from = queryDate(req, "from");
  const to = queryDate(req, "to");
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days < 0 || days > MAX_DAYS) return fail(400, `Range must be 0-${MAX_DAYS} days`);
  return ok(trends(getDb(), from, to));
});
