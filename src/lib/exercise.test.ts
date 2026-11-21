import { describe, expect, it } from "vitest";
import { ACTIVITIES, exerciseKcal } from "./exercise";

describe("exerciseKcal", () => {
  it("computes MET × kg × hours", () => {
    // running MET 9.8, 70 kg, 30 min → 9.8 * 70 * 0.5 = 343
    expect(exerciseKcal("running", 30, 70)).toBe(343);
  });

  it("falls back to a moderate MET for unknown activities", () => {
    expect(exerciseKcal("underwater basket weaving", 60, 70)).toBe(Math.round(4 * 70));
  });

  it("has positive METs for every activity", () => {
    for (const a of ACTIVITIES) expect(a.met).toBeGreaterThan(0);
  });
});
