// Per-exercise views: progress lists and the detail screen.
import type { DB } from "../db";
import { NotFoundError } from "../log";
import { addDays } from "../dates";
import { type HistoryRow, liftSeries, type LiftPoint, recordsTimeline, type RecordHit } from "./analytics";
import { currentBodyKg, loadRows } from "./history";
import type { LiftTrend } from "./insights";
import { e1rm, isWorking, type SetData } from "./metrics";
import { getMovement, type Movement } from "./movements";
import type { Target } from "./muscles";

const TREND_WINDOW_DAYS = 28;
const TOP_LIFTS = 5;
const MIN_TREND_POINTS = 3;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Compares the two most recent sessions with the two oldest in the window, which smooths out one-off days. */
function changePct(points: LiftPoint[]): number | null {
  const e = points.flatMap((p) => (p.e1rm === null ? [] : [p.e1rm]));
  if (e.length < MIN_TREND_POINTS) return null;
  const first = mean(e.slice(0, 2));
  return ((mean(e.slice(-2)) - first) / first) * 100;
}

const byMovement = (rows: HistoryRow[]): Map<number, HistoryRow[]> => {
  const out = new Map<number, HistoryRow[]>();
  for (const r of rows) out.set(r.movementId, [...(out.get(r.movementId) ?? []), r]);
  return out;
};

/** Your most-trained barbell-style lifts over the last four weeks. */
export function liftTrends(db: DB, date: string): LiftTrend[] {
  const bodyKg = currentBodyKg(db);
  const rows = loadRows(db, { from: addDays(date, -TREND_WINDOW_DAYS), to: date }).filter((r) => r.kind === "load");
  return [...byMovement(rows).entries()]
    .flatMap(([movementId, own]) => {
      const points = liftSeries(own, movementId, bodyKg);
      const change = changePct(points);
      return change === null ? [] : [{ movementId, name: own[0].movementName, changePct: change, sessions: points.length }];
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_LIFTS);
}

export interface LiftListItem {
  movementId: number;
  name: string;
  primary: Target;
  isCardio: boolean;
  sessions: number;
  lastDate: string;
  bestE1rm: number | null;
  bestWeight: number;
  changePct: number | null;
  spark: number[];
}

const SPARK_POINTS = 12;

export function liftsList(db: DB, today: string): LiftListItem[] {
  const bodyKg = currentBodyKg(db);
  const cutoff = addDays(today, -TREND_WINDOW_DAYS);
  return [...byMovement(loadRows(db)).entries()]
    .map(([movementId, own]) => {
      const points = liftSeries(own, movementId, bodyKg);
      const estimates = points.flatMap((p) => (p.e1rm === null ? [] : [p.e1rm]));
      return {
        movementId, name: own[0].movementName, primary: own[0].primary, isCardio: own[0].kind === "cardio",
        sessions: points.length, lastDate: own.at(-1)!.date,
        bestE1rm: estimates.length ? Math.max(...estimates) : null,
        bestWeight: Math.max(0, ...points.map((p) => p.topWeight)),
        changePct: changePct(points.filter((p) => p.date >= cutoff)),
        spark: estimates.slice(-SPARK_POINTS),
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.sessions - a.sessions);
}

export interface CardioPoint {
  workoutId: number;
  date: string;
  minutes: number;
  km: number;
  kcal: number;
  speedKmh: number | null;
}

export interface LiftSession {
  workoutId: number;
  date: string;
  sets: SetData[];
}

export interface LiftDetail {
  movement: Movement;
  series: LiftPoint[];
  cardio: CardioPoint[];
  sessions: LiftSession[];
  records: RecordHit[];
  /** Heaviest weight lifted at each rep count. */
  repBests: { reps: number; weightKg: number; date: string }[];
  bestE1rm: number | null;
}

const MAX_REP_BEST = 12;
const SESSION_LIMIT = 20;

function cardioPoints(rows: HistoryRow[]): CardioPoint[] {
  const out = new Map<number, CardioPoint>();
  for (const r of rows) {
    const c = out.get(r.workoutId) ?? { workoutId: r.workoutId, date: r.date, minutes: 0, km: 0, kcal: 0, speedKmh: null };
    out.set(r.workoutId, {
      ...c, minutes: c.minutes + (r.set.durationSec ?? 0) / 60, km: c.km + (r.set.distanceKm ?? 0),
      kcal: c.kcal + (r.set.kcal ?? 0), speedKmh: r.set.speedKmh ?? c.speedKmh,
    });
  }
  return [...out.values()];
}

function repBests(rows: HistoryRow[]): LiftDetail["repBests"] {
  const best = new Map<number, { reps: number; weightKg: number; date: string }>();
  for (const r of rows) {
    const { reps, weightKg } = r.set;
    if (!isWorking(r.set) || !reps || !weightKg || reps > MAX_REP_BEST) continue;
    if (weightKg > (best.get(reps)?.weightKg ?? 0)) best.set(reps, { reps, weightKg, date: r.date });
  }
  return [...best.values()].sort((a, b) => a.reps - b.reps);
}

export function liftDetail(db: DB, movementId: number): LiftDetail {
  const movement = getMovement(db, movementId);
  if (!movement) throw new NotFoundError(`Exercise ${movementId} not found`);
  const bodyKg = currentBodyKg(db);
  const rows = loadRows(db, { movementIds: [movementId] });
  const series = liftSeries(rows, movementId, bodyKg);
  const sessions = new Map<number, LiftSession>();
  for (const r of rows) {
    const s = sessions.get(r.workoutId) ?? { workoutId: r.workoutId, date: r.date, sets: [] };
    sessions.set(r.workoutId, { ...s, sets: [...s.sets, r.set] });
  }
  const estimates = rows.flatMap((r) => { const e = isWorking(r.set) ? e1rm(r.set.weightKg, r.set.reps) : null; return e ? [e] : []; });
  return {
    movement, series,
    cardio: movement.kind === "cardio" ? cardioPoints(rows) : [],
    sessions: [...sessions.values()].reverse().slice(0, SESSION_LIMIT),
    records: recordsTimeline(rows, bodyKg).reverse(),
    repBests: repBests(rows),
    bestE1rm: estimates.length ? Math.max(...estimates) : null,
  };
}
