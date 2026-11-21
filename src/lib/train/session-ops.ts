// Immutable edits to the session being logged. The client applies these and autosaves the result.
import type { MovementKind } from "./catalog";
import { emptySet, type SetData, type SetKind } from "./metrics";
import type { Movement } from "./movements";
import type { WorkoutItem } from "./workouts";

export const DEFAULT_REST_SEC = 120;
const STARTING_SETS = 3;

const replaceAt = <T>(list: T[], i: number, value: T): T[] => list.map((x, n) => (n === i ? value : x));

export function newItem(movement: Movement, previousSetCount: number | null): WorkoutItem {
  const count = movement.kind === "cardio" ? 1 : previousSetCount || STARTING_SETS;
  return {
    movement, supersetId: null, notes: "", targetReps: null,
    restSec: movement.kind === "cardio" ? 0 : DEFAULT_REST_SEC,
    sets: Array.from({ length: count }, emptySet),
  };
}

export function moveItem(items: WorkoutItem[], from: number, to: number): WorkoutItem[] {
  if (to < 0 || to >= items.length) return items;
  const next = items.filter((_, i) => i !== from);
  return [...next.slice(0, to), items[from], ...next.slice(to)];
}

export const removeItem = (items: WorkoutItem[], i: number): WorkoutItem[] => items.filter((_, n) => n !== i);

export const patchItem = (items: WorkoutItem[], i: number, patch: Partial<WorkoutItem>): WorkoutItem[] =>
  replaceAt(items, i, { ...items[i], ...patch });

/** A new set starts from the one before it, so a straight-sets session is one tap per set. */
export function addSet(items: WorkoutItem[], i: number): WorkoutItem[] {
  const last = items[i].sets.at(-1);
  const set: SetData = last ? { ...emptySet(), kind: last.kind === "warmup" ? "normal" : last.kind, weightKg: last.weightKg, reps: last.reps } : emptySet();
  return patchItem(items, i, { sets: [...items[i].sets, set] });
}

export const removeSet = (items: WorkoutItem[], i: number, s: number): WorkoutItem[] =>
  patchItem(items, i, { sets: items[i].sets.filter((_, n) => n !== s) });

export const patchSet = (items: WorkoutItem[], i: number, s: number, patch: Partial<SetData>): WorkoutItem[] =>
  patchItem(items, i, { sets: replaceAt(items[i].sets, s, { ...items[i].sets[s], ...patch }) });

export interface SetHints {
  weightKg: number | null;
  reps: number | null;
}

/** Ticking a set takes any empty field from the grey hint shown in it. Returns null if there's nothing to log. */
export function completeSet(kind: MovementKind, set: SetData, hints: SetHints): SetData | null {
  if (kind === "cardio" || kind === "hold") {
    return (set.durationSec ?? 0) > 0 || (set.distanceKm ?? 0) > 0 || (set.kcal ?? 0) > 0 ? { ...set, done: true } : null;
  }
  const reps = set.reps ?? hints.reps;
  if (!reps) return null;
  return { ...set, reps, weightKg: set.weightKg ?? hints.weightKg, done: true };
}

/** Which hint to show in a set: the matching set from last time, else the routine's target. */
export function hintsFor(previous: SetData[] | undefined, index: number, targetReps: number | null, kind: SetKind): SetHints {
  const sameKind = previous?.filter((s) => (kind === "warmup" ? s.kind === "warmup" : s.kind !== "warmup")) ?? [];
  const match = sameKind[index] ?? sameKind.at(-1);
  return { weightKg: match?.weightKg ?? null, reps: match?.reps ?? targetReps };
}

/** Links an exercise to the next one, or unlinks it. */
export function toggleSuperset(items: WorkoutItem[], i: number): WorkoutItem[] {
  const item = items[i];
  const next = items[i + 1];
  if (item.supersetId !== null && next?.supersetId === item.supersetId) {
    return patchItem(patchItem(items, i, { supersetId: null }), i + 1, { supersetId: null });
  }
  if (!next) return items;
  const id = item.supersetId ?? next.supersetId ?? Math.max(0, ...items.map((x) => x.supersetId ?? 0)) + 1;
  return patchItem(patchItem(items, i, { supersetId: id }), i + 1, { supersetId: id });
}

/** With a superset, rest only starts after the last exercise in the group. */
export function restAfter(items: WorkoutItem[], i: number): number {
  const item = items[i];
  const next = items[i + 1];
  if (item.supersetId !== null && next?.supersetId === item.supersetId) return 0;
  return item.restSec;
}

export const SET_KIND_CYCLE: SetKind[] = ["normal", "warmup", "drop", "failure"];
