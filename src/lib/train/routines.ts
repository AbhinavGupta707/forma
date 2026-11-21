import type { DB } from "../db";
import { NotFoundError } from "../log";
import { getMovement, type Movement } from "./movements";
import { getWorkout } from "./workouts";

export interface RoutineItemInput {
  movementId: number;
  sets: number;
  reps: number | null;
  restSec: number;
  supersetId: number | null;
}

export interface RoutineInput {
  name: string;
  notes: string;
  items: RoutineItemInput[];
}

export interface RoutineItem extends RoutineItemInput {
  movement: Movement;
}

export interface Routine {
  id: number;
  name: string;
  notes: string;
  items: RoutineItem[];
  lastDone: string | null;
}

function writeItems(db: DB, id: number, items: RoutineItemInput[]): void {
  db.prepare("DELETE FROM routine_items WHERE routine_id = ?").run(id);
  const add = db.prepare(
    "INSERT INTO routine_items (routine_id, movement_id, position, sets, reps, rest_sec, superset_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  items.forEach((i, position) => add.run(id, i.movementId, position, i.sets, i.reps, i.restSec, i.supersetId));
}

export function createRoutine(db: DB, input: RoutineInput): number {
  return db.transaction(() => {
    const id = Number(db.prepare("INSERT INTO routines (name, notes) VALUES (?, ?)").run(input.name, input.notes).lastInsertRowid);
    writeItems(db, id, input.items);
    return id;
  })();
}

export function updateRoutine(db: DB, id: number, input: RoutineInput): void {
  db.transaction(() => {
    const { changes } = db.prepare("UPDATE routines SET name = ?, notes = ? WHERE id = ?").run(input.name, input.notes, id);
    if (changes === 0) throw new NotFoundError(`Routine ${id} not found`);
    writeItems(db, id, input.items);
  })();
}

export function deleteRoutine(db: DB, id: number): void {
  db.prepare("DELETE FROM routines WHERE id = ?").run(id);
}

export function getRoutine(db: DB, id: number): Routine {
  const r = db.prepare("SELECT id, name, notes FROM routines WHERE id = ?").get(id) as { id: number; name: string; notes: string } | undefined;
  if (!r) throw new NotFoundError(`Routine ${id} not found`);
  const rows = db.prepare("SELECT * FROM routine_items WHERE routine_id = ? ORDER BY position").all(id) as
    { movement_id: number; sets: number; reps: number | null; rest_sec: number; superset_id: number | null }[];
  const last = db.prepare("SELECT max(date) AS d FROM workouts WHERE routine_id = ? AND status = 'done'").get(id) as { d: string | null };
  return {
    ...r, lastDone: last.d,
    items: rows.map((i) => ({
      movementId: i.movement_id, sets: i.sets, reps: i.reps, restSec: i.rest_sec, supersetId: i.superset_id,
      movement: getMovement(db, i.movement_id)!,
    })),
  };
}

export function listRoutines(db: DB): Routine[] {
  const ids = db.prepare("SELECT id FROM routines ORDER BY name").all() as { id: number }[];
  return ids.map((r) => getRoutine(db, r.id));
}

/** A finished session becomes a template: working-set count and reps, not the weights. */
export function routineFromWorkout(db: DB, workoutId: number, name: string): Routine {
  const w = getWorkout(db, workoutId);
  const items = w.items.map((i) => {
    const working = i.sets.filter((s) => s.kind !== "warmup");
    return {
      movementId: i.movement.id, sets: Math.max(1, working.length), reps: working[0]?.reps ?? i.targetReps,
      restSec: i.restSec, supersetId: i.supersetId,
    };
  });
  return getRoutine(db, createRoutine(db, { name, notes: "", items }));
}
