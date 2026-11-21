import { z } from "zod";
import { getDb } from "@/lib/db";
import { exerciseKcal, findActivity } from "@/lib/exercise";
import { addExercise } from "@/lib/log";
import { getProfile } from "@/lib/settings";
import { dateSchema, handle, ok, parseBody } from "@/lib/api";

const schema = z.object({
  date: dateSchema,
  minutes: z.number().nonnegative().max(1440),
  activity: z.string().optional(),
  label: z.string().trim().max(120).optional(),
  kcal: z.number().nonnegative().max(10000).optional(),
});

export const POST = handle(async (req: Request) => {
  const b = await parseBody(req, schema);
  const db = getDb();
  const kcal = b.kcal ?? exerciseKcal(b.activity ?? "", b.minutes, getProfile(db).weightKg);
  const label = b.label || findActivity(b.activity ?? "")?.label || "Exercise";
  return ok({ id: addExercise(db, { date: b.date, label, minutes: b.minutes, kcal }) }, 201);
});
