import { beforeEach, describe, expect, it } from "vitest";
import { type DB, openDb } from "../db";
import { getDay, logWeight } from "../log";
import { emptySet } from "./metrics";
import { movementByKey, searchMovements } from "./movements";
import { activeWorkout, createWorkout, deleteWorkout, finishWorkout, getWorkout, saveWorkout } from "./workouts";
import { previousSession } from "./history";
import { createRoutine, routineFromWorkout } from "./routines";

let db: DB;
const bench = () => movementByKey(db, "barbell-bench-press")!;
const treadmill = () => movementByKey(db, "treadmill")!;
const s = (weightKg: number, reps: number, done = true) => ({ ...emptySet(), weightKg, reps, done });

function logged(date: string, sets: ReturnType<typeof s>[]) {
  const id = createWorkout(db, { date, retro: true }).id;
  saveWorkout(db, id, { name: "Push", notes: "", date, items: [{ movementId: bench().id, supersetId: null, notes: "", restSec: 120, targetReps: null, sets }] });
  return finishWorkout(db, id, { durationMin: 60, rpe: null, notes: "", kcal: null });
}

beforeEach(() => {
  db = openDb(":memory:");
  logWeight(db, "2026-11-01", 90);
});

describe("library", () => {
  it("seeds movements with muscles", () => {
    expect(bench().primary).toBe("chest");
    expect(bench().secondary).toContain("triceps");
  });
  it("finds by loose words and muscle", () => {
    expect(searchMovements(db, { q: "bench" }).map((m) => m.key)).toContain("barbell-bench-press");
    expect(searchMovements(db, { muscle: "hamstrings" }).every((m) => m.primary === "hamstrings" || m.secondary.includes("hamstrings"))).toBe(true);
  });
});

describe("workout lifecycle", () => {
  it("saves and reloads a whole session", () => {
    const id = createWorkout(db, { date: "2026-11-02" }).id;
    saveWorkout(db, id, { name: "Push", notes: "n", date: "2026-11-02", items: [
      { movementId: bench().id, supersetId: null, notes: "", restSec: 90, targetReps: null, sets: [s(60, 8), s(60, 7, false)] },
    ] });
    const w = getWorkout(db, id);
    expect(w.items[0].sets).toHaveLength(2);
    expect(w.items[0].sets[1].done).toBe(false);
    expect(w.items[0].movement.name).toBe("Barbell Bench Press");
  });

  it("keeps a single active session and resumes it", () => {
    const a = createWorkout(db, { date: "2026-11-02" });
    const b = createWorkout(db, { date: "2026-11-02" });
    expect(b.id).toBe(a.id);
    expect(b.resumed).toBe(true);
    expect(activeWorkout(db)?.id).toBe(a.id);
  });

  it("on finish counts filled sets, drops empty ones and feeds the calorie budget", () => {
    const id = createWorkout(db, { date: "2026-11-02", retro: true }).id;
    saveWorkout(db, id, { name: "Mixed", notes: "", date: "2026-11-02", items: [
      { movementId: bench().id, supersetId: null, notes: "", restSec: 90, targetReps: null, sets: [s(60, 8, false), { ...emptySet() }] },
      { movementId: treadmill().id, supersetId: null, notes: "", restSec: 0, targetReps: null, sets: [{ ...emptySet(), durationSec: 1800, kcal: 400 }] },
    ] });
    const r = finishWorkout(db, id, { durationMin: 60, rpe: 8, notes: "", kcal: null });
    expect(r.workout.status).toBe("done");
    expect(r.workout.items[0].sets).toHaveLength(1);
    expect(r.workout.items[0].sets[0].done).toBe(true);
    expect(r.workout.kcal).toBe(400 + Math.round(3.5 * 90 * 0.5));
    expect(getDay(db, "2026-11-02").exerciseKcal).toBe(r.workout.kcal);
    expect(getDay(db, "2026-11-02").exercises[0].label).toBe("Mixed");
  });

  it("uses a typed calorie figure and updates rather than duplicates on re-finish", () => {
    const { workout } = logged("2026-11-02", [s(60, 8)]);
    finishWorkout(db, workout.id, { durationMin: 60, rpe: null, notes: "", kcal: 222 });
    const day = getDay(db, "2026-11-02");
    expect(day.exercises).toHaveLength(1);
    expect(day.exerciseKcal).toBe(222);
  });

  it("gives a past session no end time, so recovery uses its date rather than now", () => {
    expect(logged("2026-10-01", [s(60, 8)]).workout.endedAt).toBeNull();
  });

  it("delete removes sets and the calorie credit", () => {
    const { workout } = logged("2026-11-02", [s(60, 8)]);
    deleteWorkout(db, workout.id);
    expect(getDay(db, "2026-11-02").exercises).toHaveLength(0);
    expect(db.prepare("SELECT count(*) AS c FROM workout_sets").get()).toEqual({ c: 0 });
  });
});

describe("history", () => {
  it("returns the session before this one and flags records", () => {
    logged("2026-11-02", [s(60, 8)]);
    const second = logged("2026-11-04", [s(65, 8)]);
    expect(previousSession(db, bench().id, second.workout.id)?.sets[0].weightKg).toBe(60);
    expect(second.records.map((r) => r.type)).toEqual(expect.arrayContaining(["weight", "e1rm", "volume"]));
  });
  it("does not call a first session a record", () => {
    expect(logged("2026-11-02", [s(60, 8)]).records).toEqual([]);
  });
});

describe("routines", () => {
  it("starts a session from a routine with targets and empty sets", () => {
    const rid = createRoutine(db, { name: "Push A", notes: "", items: [{ movementId: bench().id, sets: 3, reps: 8, restSec: 120, supersetId: null }] });
    const w = getWorkout(db, createWorkout(db, { date: "2026-11-02", routineId: rid }).id);
    expect(w.name).toBe("Push A");
    expect(w.items[0].sets).toHaveLength(3);
    expect(w.items[0].targetReps).toBe(8);
    expect(w.items[0].sets[0].weightKg).toBeNull();
  });
  it("saves a finished workout as a routine", () => {
    const { workout } = logged("2026-11-02", [s(60, 8), s(60, 8)]);
    const r = routineFromWorkout(db, workout.id, "Push B");
    expect(r.items[0]).toMatchObject({ sets: 2, reps: 8 });
  });
});
