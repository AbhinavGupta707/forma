import { describe, expect, it } from "vitest";
import { emptySet } from "./metrics";
import type { Movement } from "./movements";
import { addSet, completeSet, hintsFor, moveItem, newItem, patchSet, restAfter, toggleSuperset } from "./session-ops";

const m = (name: string, kind: Movement["kind"] = "load"): Movement => ({
  id: name.length, key: name, name, kind, equipment: "barbell", primary: "chest", secondary: [], met: null, custom: false,
});

describe("session edits", () => {
  it("does not mutate the original list", () => {
    const items = [newItem(m("a"), 2)];
    const next = patchSet(items, 0, 0, { reps: 8 });
    expect(items[0].sets[0].reps).toBeNull();
    expect(next[0].sets[0].reps).toBe(8);
  });
  it("starts cardio with a single entry", () => expect(newItem(m("run", "cardio"), null).sets).toHaveLength(1));
  it("copies the previous set when adding one, unticked", () => {
    const items = patchSet([newItem(m("a"), 1)], 0, 0, { weightKg: 60, reps: 8, done: true });
    expect(addSet(items, 0)[0].sets[1]).toMatchObject({ weightKg: 60, reps: 8, done: false });
  });
  it("moves within bounds", () => {
    const items = [newItem(m("a"), 1), newItem(m("bb"), 1)];
    expect(moveItem(items, 0, 1).map((i) => i.movement.key)).toEqual(["bb", "a"]);
    expect(moveItem(items, 0, -1)).toBe(items);
  });
});

describe("ticking a set", () => {
  it("fills blanks from the hint", () => {
    expect(completeSet("load", emptySet(), { weightKg: 60, reps: 8 })).toMatchObject({ weightKg: 60, reps: 8, done: true });
  });
  it("keeps what you typed", () => {
    expect(completeSet("load", { ...emptySet(), weightKg: 65 }, { weightKg: 60, reps: 8 })).toMatchObject({ weightKg: 65, reps: 8 });
  });
  it("refuses a set with no reps at all", () => expect(completeSet("load", emptySet(), { weightKg: null, reps: null })).toBeNull());
  it("needs time or distance for cardio", () => {
    expect(completeSet("cardio", emptySet(), { weightKg: null, reps: null })).toBeNull();
    expect(completeSet("cardio", { ...emptySet(), durationSec: 600 }, { weightKg: null, reps: null })?.done).toBe(true);
  });
});

describe("hints", () => {
  const prev = [{ ...emptySet(), kind: "warmup" as const, weightKg: 20, reps: 10 }, { ...emptySet(), weightKg: 60, reps: 8 }];
  it("lines working sets up with working sets", () => expect(hintsFor(prev, 0, null, "normal")).toEqual({ weightKg: 60, reps: 8 }));
  it("repeats the last set if you do more than last time", () => expect(hintsFor(prev, 4, null, "normal").weightKg).toBe(60));
  it("falls back to the routine target", () => expect(hintsFor(undefined, 0, 10, "normal")).toEqual({ weightKg: null, reps: 10 }));
});

describe("supersets", () => {
  it("links, delays rest to the last exercise, and unlinks", () => {
    const items = [newItem(m("a"), 1), newItem(m("bb"), 1)];
    const linked = toggleSuperset(items, 0);
    expect(linked[0].supersetId).toBe(linked[1].supersetId);
    expect(restAfter(linked, 0)).toBe(0);
    expect(restAfter(linked, 1)).toBe(120);
    expect(toggleSuperset(linked, 0)[0].supersetId).toBeNull();
  });
});
