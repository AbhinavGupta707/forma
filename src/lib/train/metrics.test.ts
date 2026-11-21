import { describe, expect, it } from "vitest";
import {
  cardioSetKcal, e1rm, emptySet, estimateWorkoutKcal, isWorking, setVolume, suggestNext, treadmillKcal,
} from "./metrics";

const set = (weightKg: number, reps: number, extra = {}) => ({ ...emptySet(), weightKg, reps, done: true, ...extra });

describe("e1rm", () => {
  it("uses Epley and returns the weight itself for a single", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.3, 1);
  });
  it("refuses high-rep sets, where the estimate stops being useful", () => {
    expect(e1rm(40, 20)).toBeNull();
    expect(e1rm(0, 5)).toBeNull();
  });
});

describe("setVolume", () => {
  it("multiplies load by reps", () => expect(setVolume("load", set(60, 8), 90)).toBe(480));
  it("counts body weight plus added weight", () => expect(setVolume("bodyweight", set(10, 5), 90)).toBe(500));
  it("subtracts assistance", () => expect(setVolume("assisted", set(30, 5), 90)).toBe(300));
  it("ignores holds and cardio", () => expect(setVolume("cardio", set(0, 0), 90)).toBe(0));
});

describe("isWorking", () => {
  it("excludes warm-ups and unticked sets", () => {
    expect(isWorking(set(60, 8))).toBe(true);
    expect(isWorking(set(60, 8, { kind: "warmup" }))).toBe(false);
    expect(isWorking(set(60, 8, { done: false }))).toBe(false);
  });
});

describe("calorie estimates", () => {
  it("applies the ACSM walking equation net of rest", () => {
    expect(treadmillKcal({ speedKmh: 6, inclinePct: 5, minutes: 30, weightKg: 90 })).toBeCloseTo(256.5, 0);
  });
  it("switches to the running equation at speed", () => {
    expect(treadmillKcal({ speedKmh: 10, inclinePct: 0, minutes: 30, weightKg: 90 })).toBeCloseTo(450, 0);
  });
  it("prefers the calories you read off the machine", () => {
    expect(cardioSetKcal({ ...emptySet(), kcal: 400, durationSec: 1800 }, 7, 90)).toBe(400);
  });
  it("falls back to MET minus resting burn", () => {
    expect(cardioSetKcal({ ...emptySet(), durationSec: 3600 }, 7, 90)).toBe(540);
  });
  it("adds cardio to strength time without double counting minutes", () => {
    const kcal = estimateWorkoutKcal({
      durationMin: 90, weightKg: 90,
      items: [
        { kind: "load", met: null, sets: [set(60, 8)] },
        { kind: "cardio", met: 7, sets: [{ ...emptySet(), kcal: 400, durationSec: 1800, done: true }] },
      ],
    });
    expect(kcal).toBe(400 + 315);
  });
});

describe("suggestNext", () => {
  it("adds weight once reps reach the top of the range", () => {
    expect(suggestNext([set(60, 10), set(60, 10), set(60, 11)], "barbell")).toMatchObject({ weightKg: 62.5, reps: 8 });
  });
  it("adds a rep before adding weight", () => {
    expect(suggestNext([set(60, 8), set(60, 7)], "barbell")).toMatchObject({ weightKg: 60, reps: 8 });
  });
  it("adds weight when logged effort was easy", () => {
    expect(suggestNext([set(60, 8, { rpe: 7 }), set(60, 8, { rpe: 7 })], "barbell")).toMatchObject({ weightKg: 62.5, reps: 8 });
  });
  it("holds when the last session was at the limit", () => {
    expect(suggestNext([set(60, 6, { rpe: 10 })], "barbell")).toMatchObject({ weightKg: 60, reps: 6 });
  });
  it("uses smaller jumps for dumbbells and nothing without data", () => {
    expect(suggestNext([set(20, 12)], "dumbbell")).toMatchObject({ weightKg: 22 });
    expect(suggestNext([], "barbell")).toBeNull();
  });
});
