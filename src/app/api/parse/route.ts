import { z } from "zod";
import { getDb } from "@/lib/db";
import { parseLog } from "@/lib/parse/pipeline";
import { getProfile } from "@/lib/settings";
import { dateSchema, handle, ok, parseBody } from "@/lib/api";

const schema = z.object({
  text: z.string().trim().min(2).max(2000),
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export const POST = handle(async (req: Request) => {
  const { text, date, time } = await parseBody(req, schema);
  const db = getDb();
  return ok(await parseLog(db, text, { date, time, weightKg: getProfile(db).weightKg }));
});
