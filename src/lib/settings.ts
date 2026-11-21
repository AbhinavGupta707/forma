import { z } from "zod";
import type { DB } from "./db";
import { DEFAULT_PROFILE, type Profile } from "./goals";

export const profileSchema = z.object({
  name: z.string().trim().max(60).optional(),
  sex: z.enum(["male", "female"]),
  age: z.number().int().min(13).max(100),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  weeklyChangeKg: z.number().min(-1.5).max(1),
  proteinPerKg: z.number().min(0.5).max(4),
  fatPct: z.number().min(10).max(60),
  kcalOverride: z.number().int().min(1000).max(6000).optional(),
});

export const prefsSchema = z.object({
  units: z.enum(["metric", "imperial"]),
  addExerciseBack: z.boolean(),
});
export type Prefs = z.infer<typeof prefsSchema>;

const DEFAULT_PREFS: Prefs = { units: "metric", addExerciseBack: true };

function read<T>(db: DB, key: string, schema: z.ZodType<T>, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  const parsed = schema.safeParse(JSON.parse(row.value));
  return parsed.success ? parsed.data : fallback;
}

function write(db: DB, key: string, value: unknown): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}

export const getProfile = (db: DB): Profile => read(db, "profile", profileSchema, DEFAULT_PROFILE);
export const saveProfile = (db: DB, p: Profile): void => write(db, "profile", p);
export const getPrefs = (db: DB): Prefs => read(db, "prefs", prefsSchema, DEFAULT_PREFS);
export const savePrefs = (db: DB, p: Prefs): void => write(db, "prefs", p);
export const isProfileSet = (db: DB): boolean =>
  db.prepare("SELECT 1 FROM settings WHERE key = 'profile'").get() !== undefined;
