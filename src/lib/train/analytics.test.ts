import { describe, expect, it } from "vitest";
import { liftSeries, muscleSets, recordsTimeline, recovery, regionSplit, volumeStatus, type HistoryRow } from "./analytics";
import { emptySet } from "./metrics";

const row = (over: Partial<HistoryRow> & { weightKg?: number; reps?: number; kind2?: "warmup" }): HistoryRow => ({
  workoutId: 1, date: "2026-11-02", endedAt: "2026-11-02T10:00:00.000Z", movementId: 1, movementName: "Bench",
  kind: "load", primary: "chest", secondary: ["triceps"],
  ...over,
  set: { ...emptySet(), weightKg: over.weightKg ?? 60, reps: over.reps ?? 8, done: true, kind: over.kind2 ?? "normal" },
});

describe("muscleSets", () => {
  it("counts primary as 1 and secondary as 0.5, skipping warm-ups and cardio", () => {
    const m = muscleSets([row({}), row({}), row({ kind2: "warmup" }), row({ kind: "cardio" })]);
    expect(m.chest).toBe(2);
    expect(m.triceps).toBe(1);
  });
});

describe("regionSplit", () => {
  it("rolls muscles into body parts with shares", () => {
    const split = regionSplit({ chest: 6, quads: 3, hamstrings: 3 });
    expect(split.find((r) => r.region === "Legs")).toMatchObject({ sets: 6, share: 0.5 });
  });
});

describe("volumeStatus", () => {
  it("bands weekly sets", () => {
    expect(volumeStatus(0)).toBe("none");
    expect(volumeStatus(5)).toBe("low");
    expect(volumeStatus(12)).toBe("target");
    expect(volumeStatus(24)).toBe("high");
  });
});

describe("liftSeries", () => {
  it("gives one point per session with the best estimate", () => {
    const s = liftSeries([row({ weightKg: 60, reps: 8 }), row({ weightKg: 70, reps: 5 }), row({ workoutId: 2, date: "2026-11-05", weightKg: 72.5, reps: 5 })], 1, 90);
    expect(s).toHaveLength(2);
    expect(s[0].e1rm).toBeCloseTo(81.7, 1);
    expect(s[0].topWeight).toBe(70);
    expect(s[0].volume).toBe(830);
  });
});

describe("recordsTimeline", () => {
  it("marks only sessions that beat what came before", () => {
    const r = recordsTimeline([
      row({ workoutId: 1, date: "2026-11-01", weightKg: 60 }),
      row({ workoutId: 2, date: "2026-11-03", weightKg: 60 }),
      row({ workoutId: 3, date: "2026-11-05", weightKg: 62.5 }),
    ], 90);
    expect(new Set(r.map((x) => x.workoutId))).toEqual(new Set([3]));
  });
});

describe("recovery", () => {
  const now = Date.parse("2026-11-02T10:00:00.000Z");
  const hard = Array.from({ length: 10 }, () => row({}));
  it("is low right after training and returns over days", () => {
    expect(recovery(hard, now).chest).toBeLessThan(0.3);
    expect(recovery(hard, now + 72 * 3_600_000).chest).toBeGreaterThan(0.85);
  });
  it("is full for muscles not trained", () => expect(recovery(hard, now).quads).toBe(1));
});
