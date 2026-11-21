// Spoken or typed workout → sets. One model call, with the exercise library in the prompt.
import { z } from "zod";
import type { DB } from "../db";
import { completeJson } from "../parse/llm";
import { emptySet, type SetData } from "./metrics";
import { type Movement, movementByKey, searchMovements } from "./movements";

const parsedSet = z.object({
  reps: z.number().nonnegative(),
  weight_kg: z.number().nonnegative(),
  rpe: z.number().nonnegative(),
  duration_min: z.number().nonnegative(),
  distance_km: z.number().nonnegative(),
  speed_kmh: z.number().nonnegative(),
  incline_pct: z.number().nonnegative(),
  kcal: z.number().nonnegative(),
});

const parsedSchema = z.object({
  items: z.array(z.object({ exercise_key: z.string(), spoken_name: z.string(), sets: z.array(parsedSet) })),
});
const parsedJsonSchema = z.toJSONSchema(parsedSchema) as Record<string, unknown>;
type ParsedSet = z.infer<typeof parsedSet>;

function prompt(db: DB): string {
  const library = searchMovements(db, { limit: 1000 }).map((m) => `${m.key}: ${m.name}`).join("\n");
  return `You turn what someone says about their gym session into structured sets.

Rules:
- Pick exercise_key from the library below. Use "" if nothing is a fair match, and keep the spoken words in spoken_name.
- Expand "3 sets of 8 at 60" into three separate set objects. "3x8" means 3 sets of 8 reps.
- Different weights or reps per set become separate objects, in order.
- Convert pounds to kg. Convert hours to minutes. Convert miles to km.
- Use 0 for anything not stated. Never guess a weight.
- For bodyweight moves, weight_kg is added weight only.
- Cardio is one set object with duration_min, plus distance_km, speed_kmh, incline_pct and kcal if stated.
- Plain "treadmill", walking or running on a machine is the treadmill key.

Library:
${library}`;
}

const toSet = (s: ParsedSet): SetData => ({
  ...emptySet(),
  reps: s.reps || null, weightKg: s.weight_kg || null, rpe: s.rpe || null,
  durationSec: s.duration_min ? s.duration_min * 60 : null, distanceKm: s.distance_km || null,
  speedKmh: s.speed_kmh || null, inclinePct: s.incline_pct || null, kcal: s.kcal || null,
  done: true,
});

export interface ParsedItem {
  movement: Movement;
  sets: SetData[];
}

export interface ParsedWorkout {
  items: ParsedItem[];
  unmatched: string[];
}

export async function parseWorkout(db: DB, text: string): Promise<ParsedWorkout> {
  const { data } = await completeJson(
    [{ role: "system", content: prompt(db) }, { role: "user", content: text }],
    parsedSchema, parsedJsonSchema,
  );
  const out: ParsedWorkout = { items: [], unmatched: [] };
  for (const item of data.items) {
    const movement = movementByKey(db, item.exercise_key) ?? searchMovements(db, { q: item.spoken_name, limit: 1 })[0] ?? null;
    if (movement && item.sets.length > 0) out.items.push({ movement, sets: item.sets.map(toSet) });
    else out.unmatched.push(item.spoken_name);
  }
  return out;
}
