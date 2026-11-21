import { getDb } from "@/lib/db";
import { handle, ok, parseBody } from "@/lib/api";
import { parseSchema } from "@/lib/train/schemas";
import { parseWorkout } from "@/lib/train/voice";
import { createWorkout, getWorkout, saveWorkout } from "@/lib/train/workouts";

/** Adds what was said to the open session, or to a new one logged after the fact. */
export const POST = handle(async (req: Request) => {
  const db = getDb();
  const { text, date, workoutId } = await parseBody(req, parseSchema);
  const parsed = await parseWorkout(db, text);
  if (parsed.items.length === 0) return ok({ workoutId: workoutId ?? null, added: 0, unmatched: parsed.unmatched });
  const id = workoutId ?? createWorkout(db, { date, retro: true }).id;
  const w = getWorkout(db, id);
  const asInput = (i: (typeof w.items)[number]) => ({ ...i, movementId: i.movement.id });
  saveWorkout(db, id, {
    name: w.name, notes: w.notes, date: w.date,
    items: [
      ...w.items.map(asInput),
      ...parsed.items.map((i) => ({
        movementId: i.movement.id, supersetId: null, notes: "", targetReps: null,
        restSec: i.movement.kind === "cardio" ? 0 : 120, sets: i.sets,
      })),
    ],
  });
  return ok({ workoutId: id, added: parsed.items.length, unmatched: parsed.unmatched });
});
