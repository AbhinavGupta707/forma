// Workout sessions: a whole session is saved as one document, which keeps autosave simple.
import type { DB } from "../db";
import { NotFoundError } from "../log";
import { MUSCLE_REGION, type Muscle } from "./muscles";
import { type RecordHit, recordsTimeline } from "./analytics";
import { currentBodyKg, loadRows, type SetRow, toSet } from "./history";
import { emptySet, estimateWorkoutKcal, hasData, type SetData } from "./metrics";
import { getMovement, type Movement } from "./movements";

export class EmptyWorkoutError extends Error {}

export type WorkoutStatus = "active" | "done";

export interface WorkoutItem {
  movement: Movement;
  supersetId: number | null;
  notes: string;
  restSec: number;
  targetReps: number | null;
  sets: SetData[];
}

export interface Workout {
  id: number;
  date: string;
  name: string;
  notes: string;
  status: WorkoutStatus;
  routineId: number | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMin: number | null;
  rpe: number | null;
  kcal: number | null;
  items: WorkoutItem[];
}

interface WorkoutRow {
  id: number;
  date: string;
  name: string;
  notes: string;
  status: WorkoutStatus;
  routine_id: number | null;
  started_at: string | null;
  ended_at: string | null;
  duration_min: number | null;
  rpe: number | null;
  kcal: number | null;
}

interface ItemRow {
  id: number;
  movement_id: number;
  superset_id: number | null;
  notes: string;
  rest_sec: number;
  target_reps: number | null;
}

export interface ItemInput {
  movementId: number;
  supersetId: number | null;
  notes: string;
  restSec: number;
  targetReps: number | null;
  sets: SetData[];
}

export interface WorkoutInput {
  name: string;
  notes: string;
  date: string;
  items: ItemInput[];
}

const DEFAULT_SETS = 3;

function row(db: DB, id: number): WorkoutRow {
  const r = db.prepare("SELECT * FROM workouts WHERE id = ?").get(id) as WorkoutRow | undefined;
  if (!r) throw new NotFoundError(`Workout ${id} not found`);
  return r;
}

export function getWorkout(db: DB, id: number): Workout {
  const r = row(db, id);
  const items = db.prepare("SELECT * FROM workout_items WHERE workout_id = ? ORDER BY position").all(id) as ItemRow[];
  const setsFor = db.prepare("SELECT * FROM workout_sets WHERE item_id = ? ORDER BY position");
  return {
    id: r.id, date: r.date, name: r.name, notes: r.notes, status: r.status, routineId: r.routine_id,
    startedAt: r.started_at, endedAt: r.ended_at, durationMin: r.duration_min, rpe: r.rpe, kcal: r.kcal,
    items: items.map((i) => ({
      movement: getMovement(db, i.movement_id)!,
      supersetId: i.superset_id, notes: i.notes, restSec: i.rest_sec, targetReps: i.target_reps,
      sets: (setsFor.all(i.id) as SetRow[]).map(toSet),
    })),
  };
}

function writeItems(db: DB, workoutId: number, items: ItemInput[]): void {
  const old = db.prepare("DELETE FROM workout_items WHERE workout_id = ?");
  const addItem = db.prepare(
    `INSERT INTO workout_items (workout_id, movement_id, position, superset_id, notes, rest_sec, target_reps)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const addSet = db.prepare(
    `INSERT INTO workout_sets (item_id, position, kind, weight_kg, reps, rpe, duration_sec, distance_km, speed_kmh, incline_pct, kcal, done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  old.run(workoutId);
  items.forEach((item, position) => {
    const itemId = addItem.run(workoutId, item.movementId, position, item.supersetId, item.notes, item.restSec, item.targetReps).lastInsertRowid;
    item.sets.forEach((s, i) => addSet.run(
      itemId, i, s.kind, s.weightKg, s.reps, s.rpe, s.durationSec, s.distanceKm, s.speedKmh, s.inclinePct, s.kcal, s.done ? 1 : 0,
    ));
  });
}

export function activeWorkout(db: DB): { id: number; name: string; startedAt: string | null } | null {
  const r = db.prepare("SELECT id, name, started_at FROM workouts WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() as
    | { id: number; name: string; started_at: string | null } | undefined;
  return r ? { id: r.id, name: r.name, startedAt: r.started_at } : null;
}

export interface CreateInput {
  date: string;
  name?: string;
  routineId?: number;
  fromWorkoutId?: number;
  /** Logging a past session: no live timer. */
  retro?: boolean;
}

function templateItems(db: DB, input: CreateInput): { name: string; items: ItemInput[] } {
  const blank = (n: number) => Array.from({ length: n }, emptySet);
  if (input.routineId) {
    const routine = db.prepare("SELECT name FROM routines WHERE id = ?").get(input.routineId) as { name: string } | undefined;
    if (!routine) throw new NotFoundError(`Routine ${input.routineId} not found`);
    const rows = db.prepare("SELECT * FROM routine_items WHERE routine_id = ? ORDER BY position").all(input.routineId) as
      { movement_id: number; sets: number; reps: number | null; rest_sec: number; superset_id: number | null }[];
    return {
      name: routine.name,
      items: rows.map((r) => ({
        movementId: r.movement_id, supersetId: r.superset_id, notes: "", restSec: r.rest_sec, targetReps: r.reps, sets: blank(r.sets),
      })),
    };
  }
  if (input.fromWorkoutId) {
    const from = getWorkout(db, input.fromWorkoutId);
    return {
      name: from.name,
      items: from.items.map((i) => ({
        movementId: i.movement.id, supersetId: i.supersetId, notes: "", restSec: i.restSec,
        targetReps: i.sets.find((s) => s.kind !== "warmup")?.reps ?? i.targetReps,
        sets: blank(i.sets.length || DEFAULT_SETS),
      })),
    };
  }
  return { name: input.name ?? "", items: [] };
}

/** Only one session can be open at a time, so asking for a new one resumes it. */
export function createWorkout(db: DB, input: CreateInput): { id: number; resumed: boolean } {
  const open = activeWorkout(db);
  if (open) return { id: open.id, resumed: true };
  const { name, items } = templateItems(db, input);
  return db.transaction(() => {
    const id = Number(db
      .prepare("INSERT INTO workouts (date, name, status, routine_id, started_at) VALUES (?, ?, 'active', ?, ?)")
      .run(input.date, name, input.routineId ?? null, input.retro ? null : new Date().toISOString()).lastInsertRowid);
    writeItems(db, id, items);
    return { id, resumed: false };
  })();
}

export function saveWorkout(db: DB, id: number, input: WorkoutInput): void {
  row(db, id);
  db.transaction(() => {
    db.prepare("UPDATE workouts SET name = ?, notes = ?, date = ? WHERE id = ?").run(input.name, input.notes, input.date, id);
    writeItems(db, id, input.items);
  })();
}

export function deleteWorkout(db: DB, id: number): void {
  row(db, id);
  db.prepare("DELETE FROM workouts WHERE id = ?").run(id);
}

function autoName(items: WorkoutItem[]): string {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (i.movement.primary === "cardio") continue;
    const region = MUSCLE_REGION[i.movement.primary as Muscle];
    counts.set(region, (counts.get(region) ?? 0) + i.sets.length);
  }
  if (counts.size === 0) return items[0]?.movement.name ?? "Cardio";
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r).join(" & ");
}

export interface FinishInput {
  durationMin: number | null;
  rpe: number | null;
  notes: string;
  /** A typed figure wins over the estimate. */
  kcal: number | null;
}

export interface FinishResult {
  workout: Workout;
  records: RecordHit[];
}

const elapsedMin = (startedAt: string | null, endedAt: string | null): number | null =>
  startedAt && endedAt ? Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000)) : null;

/** Tidies the session, then feeds its calories into the day's budget. Running it again updates in place. */
export function finishWorkout(db: DB, id: number, input: FinishInput): FinishResult {
  const current = getWorkout(db, id);
  const items = current.items
    .map((i) => ({ ...i, sets: i.sets.filter(hasData).map((s) => ({ ...s, done: true })) }))
    .filter((i) => i.sets.length > 0);
  if (items.length === 0) throw new EmptyWorkoutError("Log at least one set before finishing");

  // A session logged after the fact has no real end time, and recovery falls back to its date.
  const endedAt = current.endedAt ?? (current.startedAt ? new Date().toISOString() : null);
  const durationMin = input.durationMin ?? current.durationMin ?? elapsedMin(current.startedAt, endedAt) ?? 45;
  const weightKg = currentBodyKg(db);
  const kcal = input.kcal ?? estimateWorkoutKcal({
    durationMin, weightKg,
    items: items.map((i) => ({ kind: i.movement.kind, met: i.movement.met, treadmill: i.movement.key === "treadmill", sets: i.sets })),
  });
  const name = current.name.trim() || autoName(items);

  db.transaction(() => {
    writeItems(db, id, items.map((i) => ({ ...i, movementId: i.movement.id })));
    db.prepare(
      "UPDATE workouts SET status = 'done', name = ?, notes = ?, rpe = ?, kcal = ?, duration_min = ?, ended_at = ? WHERE id = ?",
    ).run(name, input.notes, input.rpe, kcal, durationMin, endedAt, id);
    db.prepare("DELETE FROM exercises WHERE workout_id = ?").run(id);
    if (kcal > 0) {
      db.prepare("INSERT INTO exercises (date, label, minutes, kcal, workout_id) VALUES (?, ?, ?, ?, ?)")
        .run(current.date, name, durationMin, kcal, id);
    }
  })();

  const rows = loadRows(db, { movementIds: items.map((i) => i.movement.id) });
  return { workout: getWorkout(db, id), records: recordsTimeline(rows, weightKg).filter((r) => r.workoutId === id) };
}

export interface WorkoutSummary {
  id: number;
  date: string;
  name: string;
  durationMin: number | null;
  kcal: number | null;
  rpe: number | null;
}

export function listWorkouts(db: DB, from: string, to: string): WorkoutSummary[] {
  return (db
    .prepare(
      `SELECT id, date, name, duration_min, kcal, rpe FROM workouts
        WHERE status = 'done' AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC`,
    )
    .all(from, to) as (WorkoutSummary & { duration_min: number | null })[])
    .map(({ duration_min, ...w }) => ({ ...w, durationMin: duration_min }));
}
