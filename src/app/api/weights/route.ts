import { z } from "zod";
import { getDb } from "@/lib/db";
import { logWeight } from "@/lib/log";
import { getProfile, saveProfile } from "@/lib/settings";
import { dateSchema, handle, ok, parseBody } from "@/lib/api";
import { localDate } from "@/lib/dates";

export const POST = handle(async (req: Request) => {
  const { date, kg } = await parseBody(req, z.object({ date: dateSchema, kg: z.number().min(30).max(300) }));
  const db = getDb();
  db.transaction(() => {
    logWeight(db, date, kg);
    // Today's weigh-in also updates the profile so calorie targets follow your weight.
    if (date === localDate()) saveProfile(db, { ...getProfile(db), weightKg: kg });
  })();
  return ok(null, 201);
});
