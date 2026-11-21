// Pure analytics over logged sets. Nothing here touches the database, so all of it is easy to test.
import type { MovementKind } from "./catalog";
import { e1rm, isWorking, type SetData, setVolume } from "./metrics";
import { type Muscle, MUSCLE_REGION, MUSCLES, type Region, REGIONS, type Target } from "./muscles";

export interface HistoryRow {
  workoutId: number;
  date: string;
  endedAt: string | null;
  movementId: number;
  movementName: string;
  kind: MovementKind;
  primary: Target;
  secondary: Muscle[];
  set: SetData;
}

export type MuscleMap = Partial<Record<Muscle, number>>;

// A secondary muscle counting as half a set is a common convention, not a measured value.
const SECONDARY_WEIGHT = 0.5;

const trainsMuscles = (r: HistoryRow): boolean => r.kind !== "cardio" && r.primary !== "cardio" && isWorking(r.set);

export function muscleSets(rows: HistoryRow[]): MuscleMap {
  const out: MuscleMap = {};
  for (const r of rows.filter(trainsMuscles)) {
    const primary = r.primary as Muscle;
    out[primary] = (out[primary] ?? 0) + 1;
    for (const m of r.secondary) out[m] = (out[m] ?? 0) + SECONDARY_WEIGHT;
  }
  return out;
}

export interface RegionShare {
  region: Region;
  sets: number;
  share: number;
}

export function regionSplit(muscles: MuscleMap): RegionShare[] {
  const totals = new Map<Region, number>(REGIONS.map((r) => [r, 0]));
  for (const [m, sets] of Object.entries(muscles) as [Muscle, number][]) {
    const region = MUSCLE_REGION[m];
    totals.set(region, (totals.get(region) ?? 0) + sets);
  }
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([region, sets]) => ({ region, sets, share: all > 0 ? sets / all : 0 }))
    .sort((a, b) => b.sets - a.sets);
}

export type VolumeStatus = "none" | "low" | "base" | "target" | "high";

// Weekly hard sets per muscle. Population guidelines (roughly 10-20 for growth), not personal limits.
export const VOLUME_BANDS = { low: 6, target: 10, high: 20 } as const;

export function volumeStatus(sets: number): VolumeStatus {
  if (sets <= 0) return "none";
  if (sets < VOLUME_BANDS.low) return "low";
  if (sets < VOLUME_BANDS.target) return "base";
  return sets <= VOLUME_BANDS.high ? "target" : "high";
}

export interface LiftPoint {
  workoutId: number;
  date: string;
  e1rm: number | null;
  topWeight: number;
  volume: number;
  sets: number;
  bestSet: { weightKg: number; reps: number } | null;
}

export function liftSeries(rows: HistoryRow[], movementId: number, bodyKg: number): LiftPoint[] {
  const points = new Map<number, LiftPoint>();
  for (const r of rows) {
    if (r.movementId !== movementId || !isWorking(r.set)) continue;
    const p = points.get(r.workoutId) ?? { workoutId: r.workoutId, date: r.date, e1rm: null, topWeight: 0, volume: 0, sets: 0, bestSet: null };
    const e = e1rm(r.set.weightKg, r.set.reps);
    const better = e !== null && (p.e1rm === null || e > p.e1rm);
    points.set(r.workoutId, {
      ...p,
      e1rm: better ? e : p.e1rm,
      bestSet: better ? { weightKg: r.set.weightKg ?? 0, reps: r.set.reps ?? 0 } : p.bestSet,
      topWeight: Math.max(p.topWeight, r.set.weightKg ?? 0),
      volume: p.volume + setVolume(r.kind, r.set, bodyKg),
      sets: p.sets + 1,
    });
  }
  return [...points.values()];
}

export type RecordType = "weight" | "e1rm" | "volume" | "reps" | "duration" | "distance";

export interface RecordHit {
  workoutId: number;
  date: string;
  movementId: number;
  movementName: string;
  type: RecordType;
  value: number;
  previous: number;
  label: string;
}

const RECORD_LABEL: Record<RecordType, (v: number) => string> = {
  weight: (v) => `${v} kg heaviest`,
  e1rm: (v) => `${Math.round(v)} kg est. 1RM`,
  volume: (v) => `${Math.round(v)} kg best set`,
  reps: (v) => `${v} reps`,
  duration: (v) => `${Math.round(v / 60)} min`,
  distance: (v) => `${v} km`,
};

function sessionBests(rows: HistoryRow[], bodyKg: number): Partial<Record<RecordType, number>> {
  const best: Partial<Record<RecordType, number>> = {};
  const bump = (t: RecordType, v: number | null) => { if (v) best[t] = Math.max(best[t] ?? 0, v); };
  for (const r of rows) {
    if (r.kind === "cardio") {
      bump("distance", r.set.distanceKm);
    } else if (r.kind === "hold") {
      bump("duration", r.set.durationSec);
    } else if (r.kind === "load") {
      bump("weight", r.set.weightKg);
      bump("e1rm", e1rm(r.set.weightKg, r.set.reps));
      bump("volume", setVolume(r.kind, r.set, bodyKg));
    } else {
      bump("reps", r.set.reps);
    }
  }
  return best;
}

/** Walks history in order. A first session sets the baseline rather than counting as a record. */
export function recordsTimeline(rows: HistoryRow[], bodyKg: number): RecordHit[] {
  const groups = new Map<string, HistoryRow[]>();
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.workoutId - b.workoutId);
  for (const r of sorted) {
    if (!isWorking(r.set)) continue;
    const key = `${r.workoutId}:${r.movementId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const bests = new Map<number, Partial<Record<RecordType, number>>>();
  const hits: RecordHit[] = [];
  for (const session of groups.values()) {
    const { workoutId, date, movementId, movementName } = session[0];
    const now = sessionBests(session, bodyKg);
    const before = bests.get(movementId);
    if (before) {
      for (const [type, value] of Object.entries(now) as [RecordType, number][]) {
        const previous = before[type];
        if (previous !== undefined && value > previous) {
          hits.push({ workoutId, date, movementId, movementName, type, value, previous, label: RECORD_LABEL[type](value) });
        }
      }
    }
    const merged = { ...before };
    for (const [type, value] of Object.entries(now) as [RecordType, number][]) merged[type] = Math.max(merged[type] ?? 0, value);
    bests.set(movementId, merged);
  }
  return hits;
}

// Readiness is a rough model: fatigue from recent sets halves every 24 h and a dozen fresh sets means fully worked.
const FATIGUE_HALF_LIFE_H = 24;
const FATIGUE_CEILING = 12;
const MS_PER_HOUR = 3_600_000;

const trainedAt = (r: HistoryRow): number => Date.parse(r.endedAt ?? `${r.date}T12:00:00.000Z`);

/** 0 = just hammered, 1 = fully recovered, for every muscle. */
export function recovery(rows: HistoryRow[], nowMs: number): Record<Muscle, number> {
  const fatigue: MuscleMap = {};
  const add = (m: Muscle, amount: number, hours: number) => {
    fatigue[m] = (fatigue[m] ?? 0) + amount * 2 ** (-Math.max(0, hours) / FATIGUE_HALF_LIFE_H);
  };
  for (const r of rows.filter(trainsMuscles)) {
    const hours = (nowMs - trainedAt(r)) / MS_PER_HOUR;
    add(r.primary as Muscle, 1, hours);
    for (const m of r.secondary) add(m, SECONDARY_WEIGHT, hours);
  }
  return Object.fromEntries(
    MUSCLES.map((m) => [m.key, 1 - Math.min(1, (fatigue[m.key] ?? 0) / FATIGUE_CEILING)]),
  ) as Record<Muscle, number>;
}

export interface SessionStats {
  sets: number;
  reps: number;
  volume: number;
  cardioMin: number;
  cardioKm: number;
}

export function sessionStats(rows: HistoryRow[], bodyKg: number): SessionStats {
  const out: SessionStats = { sets: 0, reps: 0, volume: 0, cardioMin: 0, cardioKm: 0 };
  for (const r of rows) {
    if (!isWorking(r.set)) continue;
    if (r.kind === "cardio") {
      out.cardioMin += (r.set.durationSec ?? 0) / 60;
      out.cardioKm += r.set.distanceKm ?? 0;
    } else {
      out.sets += 1;
      out.reps += r.set.reps ?? 0;
      out.volume += setVolume(r.kind, r.set, bodyKg);
    }
  }
  return out;
}
