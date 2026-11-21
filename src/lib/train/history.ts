// Read-only views over finished workouts.
import type { DB } from "../db";
import { getProfile } from "../settings";
import type { HistoryRow } from "./analytics";
import { getMovement } from "./movements";
import { e1rm, type SetData, type SetKind, suggestNext, type Suggestion } from "./metrics";
import type { MovementKind } from "./catalog";
import type { Muscle, Target } from "./muscles";

export function currentBodyKg(db: DB): number {
  const r = db.prepare("SELECT kg FROM weights ORDER BY date DESC LIMIT 1").get() as { kg: number } | undefined;
  return r?.kg ?? getProfile(db).weightKg;
}

export interface SetRow {
  kind: SetKind;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_sec: number | null;
  distance_km: number | null;
  speed_kmh: number | null;
  incline_pct: number | null;
  kcal: number | null;
  done: number;
}

export const toSet = (r: SetRow): SetData => ({
  kind: r.kind, weightKg: r.weight_kg, reps: r.reps, rpe: r.rpe, durationSec: r.duration_sec,
  distanceKm: r.distance_km, speedKmh: r.speed_kmh, inclinePct: r.incline_pct, kcal: r.kcal, done: r.done === 1,
});

interface JoinedRow extends SetRow {
  workout_id: number;
  date: string;
  ended_at: string | null;
  movement_id: number;
  movement_name: string;
  movement_kind: MovementKind;
  primary_muscle: Target;
  secondary: string;
}

export interface HistoryFilter {
  from?: string;
  to?: string;
  movementIds?: number[];
}

/** Every ticked set in finished workouts, oldest first. Analytics run over this list in memory. */
export function loadRows(db: DB, f: HistoryFilter = {}): HistoryRow[] {
  const where = ["w.status = 'done'", "s.done = 1"];
  const args: (string | number)[] = [];
  if (f.from) { where.push("w.date >= ?"); args.push(f.from); }
  if (f.to) { where.push("w.date <= ?"); args.push(f.to); }
  if (f.movementIds) {
    where.push(`i.movement_id IN (${f.movementIds.map(() => "?").join(",") || "NULL"})`);
    args.push(...f.movementIds);
  }
  const rows = db
    .prepare(
      `SELECT s.*, w.id AS workout_id, w.date, w.ended_at, m.id AS movement_id, m.name AS movement_name,
              m.kind AS movement_kind, m.primary_muscle, m.secondary
         FROM workout_sets s
         JOIN workout_items i ON i.id = s.item_id
         JOIN workouts w ON w.id = i.workout_id
         JOIN movements m ON m.id = i.movement_id
        WHERE ${where.join(" AND ")}
        ORDER BY w.date, w.id, i.position, s.position`,
    )
    .all(...args) as (JoinedRow & { kind: SetKind })[];
  return rows.map((r) => ({
    workoutId: r.workout_id, date: r.date, endedAt: r.ended_at, movementId: r.movement_id, movementName: r.movement_name,
    kind: r.movement_kind, primary: r.primary_muscle, secondary: JSON.parse(r.secondary) as Muscle[], set: toSet(r),
  }));
}

export interface PastSession {
  workoutId: number;
  date: string;
  sets: SetData[];
}

/** The last finished session of a movement before the given workout (or ever, with no workout). */
export function previousSession(db: DB, movementId: number, workoutId?: number): PastSession | null {
  const cur = workoutId
    ? (db.prepare("SELECT date, id FROM workouts WHERE id = ?").get(workoutId) as { date: string; id: number } | undefined)
    : undefined;
  const item = db
    .prepare(
      `SELECT i.id, w.id AS workout_id, w.date
         FROM workout_items i JOIN workouts w ON w.id = i.workout_id
        WHERE i.movement_id = ? AND w.status = 'done'
          ${cur ? "AND (w.date < ? OR (w.date = ? AND w.id < ?))" : ""}
        ORDER BY w.date DESC, w.id DESC LIMIT 1`,
    )
    .get(...(cur ? [movementId, cur.date, cur.date, cur.id] : [movementId])) as
    | { id: number; workout_id: number; date: string }
    | undefined;
  if (!item) return null;
  const sets = (db.prepare("SELECT * FROM workout_sets WHERE item_id = ? ORDER BY position").all(item.id) as SetRow[]).map(toSet);
  return { workoutId: item.workout_id, date: item.date, sets };
}

export interface MovementContext {
  previous: PastSession | null;
  suggestion: Suggestion | null;
  /** Best estimated 1RM and heaviest weight so far, used to spot records while logging. */
  bestE1rm: number | null;
  bestWeight: number | null;
}

export function movementContext(db: DB, movementId: number, workoutId?: number): MovementContext {
  const movement = getMovement(db, movementId);
  const previous = previousSession(db, movementId, workoutId);
  const rows = loadRows(db, { movementIds: [movementId] }).filter((r) => r.workoutId !== workoutId && r.set.kind !== "warmup");
  const estimates = rows.flatMap((r) => { const e = e1rm(r.set.weightKg, r.set.reps); return e ? [e] : []; });
  const weights = rows.flatMap((r) => (r.set.weightKg ? [r.set.weightKg] : []));
  return {
    previous,
    suggestion: previous && movement && movement.kind !== "cardio" && movement.kind !== "hold"
      ? suggestNext(previous.sets, movement.equipment) : null,
    bestE1rm: estimates.length ? Math.max(...estimates) : null,
    bestWeight: weights.length ? Math.max(...weights) : null,
  };
}
