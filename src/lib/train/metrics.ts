// Pure workout maths: load, volume, one-rep-max estimates, calorie burn and progression.
import type { Equipment, MovementKind } from "./catalog";

export type SetKind = "normal" | "warmup" | "drop" | "failure";

export interface SetData {
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  durationSec: number | null;
  distanceKm: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  kcal: number | null;
  done: boolean;
}

export const emptySet = (): SetData => ({
  kind: "normal", weightKg: null, reps: null, rpe: null, durationSec: null, distanceKm: null,
  speedKmh: null, inclinePct: null, kcal: null, done: false,
});

const MAX_E1RM_REPS = 12;

/** Epley estimate. Above 12 reps the formula overstates strength, so no estimate is given. */
export function e1rm(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0 || reps > MAX_E1RM_REPS) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export const isWorking = (s: SetData): boolean => s.done && s.kind !== "warmup";

export const hasData = (s: SetData): boolean =>
  (s.reps ?? 0) > 0 || (s.durationSec ?? 0) > 0 || (s.distanceKm ?? 0) > 0 || (s.kcal ?? 0) > 0;

/** Weight actually moved in a set, taking body weight into account. */
export function effectiveLoad(kind: MovementKind, weightKg: number | null, bodyKg: number): number {
  const w = weightKg ?? 0;
  if (kind === "bodyweight") return bodyKg + w;
  if (kind === "assisted") return Math.max(0, bodyKg - w);
  return w;
}

export function setVolume(kind: MovementKind, s: SetData, bodyKg: number): number {
  if (kind === "cardio" || kind === "hold") return 0;
  return effectiveLoad(kind, s.weightKg, bodyKg) * (s.reps ?? 0);
}

// Calorie figures are net of resting burn, because the daily baseline already counts that.
const STRENGTH_NET_MET = 3.5;
const RESTING_MET = 1;
const RUN_THRESHOLD_KMH = 7;
const KCAL_PER_LITRE_O2 = 5;

/** ACSM metabolic equations, net of the 3.5 ml/kg/min resting term. */
export function treadmillKcal(p: { speedKmh: number; inclinePct: number; minutes: number; weightKg: number }): number {
  const metresPerMin = (p.speedKmh * 1000) / 60;
  const grade = p.inclinePct / 100;
  const running = p.speedKmh >= RUN_THRESHOLD_KMH;
  const vo2 = running ? 0.2 * metresPerMin + 0.9 * metresPerMin * grade : 0.1 * metresPerMin + 1.8 * metresPerMin * grade;
  return (vo2 * p.weightKg * p.minutes * KCAL_PER_LITRE_O2) / 1000;
}

export function cardioSetKcal(s: SetData, met: number, weightKg: number, treadmill = false): number {
  if (s.kcal) return s.kcal;
  const minutes = (s.durationSec ?? 0) / 60;
  if (treadmill && s.speedKmh) {
    return treadmillKcal({ speedKmh: s.speedKmh, inclinePct: s.inclinePct ?? 0, minutes, weightKg });
  }
  return (met - RESTING_MET) * weightKg * (minutes / 60);
}

export interface KcalItem {
  kind: MovementKind;
  met: number | null;
  treadmill?: boolean;
  sets: SetData[];
}

/** Cardio is costed per set; whatever time is left in the session counts as strength work. */
export function estimateWorkoutKcal(p: { durationMin: number; weightKg: number; items: KcalItem[] }): number {
  const cardio = p.items.filter((i) => i.kind === "cardio");
  const cardioKcal = cardio.reduce(
    (sum, i) => sum + i.sets.reduce((s, set) => s + cardioSetKcal(set, i.met ?? 4, p.weightKg, i.treadmill), 0), 0);
  const cardioMin = cardio.reduce((sum, i) => sum + i.sets.reduce((s, set) => s + (set.durationSec ?? 0) / 60, 0), 0);
  const strengthMin = cardio.length === p.items.length ? 0 : Math.max(0, p.durationMin - cardioMin);
  return Math.round(cardioKcal + STRENGTH_NET_MET * p.weightKg * (strengthMin / 60));
}

export interface Suggestion {
  weightKg: number;
  reps: number;
  reason: string;
}

const TOP_OF_RANGE = 10;
const RESET_REPS = 8;
const EASY_RPE = 8;
const LIMIT_RPE = 9.5;
const round = (n: number) => Math.round(n * 100) / 100;

/** Double progression from the last session: add reps first, then weight. */
export function suggestNext(sets: SetData[], equipment: Equipment): Suggestion | null {
  const working = sets.filter(isWorking).filter((s) => (s.reps ?? 0) > 0);
  if (working.length === 0) return null;
  const top = Math.max(...working.map((s) => s.weightKg ?? 0));
  const atTop = working.filter((s) => (s.weightKg ?? 0) === top);
  const minReps = Math.min(...atTop.map((s) => s.reps ?? 0));
  const rpes = atTop.flatMap((s) => (s.rpe === null ? [] : [s.rpe]));
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const step = equipment === "dumbbell" ? 2 : 2.5;

  if (top === 0) return { weightKg: 0, reps: minReps + 1, reason: "One more rep than last time" };
  if (avgRpe !== null && avgRpe >= LIMIT_RPE) return { weightKg: top, reps: minReps, reason: "Last time was at your limit, so match it" };
  if (avgRpe !== null && avgRpe <= EASY_RPE) return { weightKg: round(top + step), reps: minReps, reason: "Last time felt manageable" };
  if (minReps >= TOP_OF_RANGE) return { weightKg: round(top + step), reps: RESET_REPS, reason: `You hit ${minReps}+ on every set` };
  return { weightKg: top, reps: minReps + 1, reason: "Add a rep before adding weight" };
}
