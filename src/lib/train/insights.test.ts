import { describe, expect, it } from "vitest";
import { buildInsights, type InsightInput } from "./insights";

const base: InsightInput = {
  sessionsThisWeek: 3, weekDayIndex: 5, muscles: {}, recordsThisWeek: [], streakWeeks: 0, cardioMin: 0,
  lifts: [], protein: null, volumeJump: null, cutting: true,
};

const ids = (i: Partial<InsightInput>) => buildInsights({ ...base, ...i }).map((x) => x.id);

describe("buildInsights", () => {
  it("celebrates records first", () => {
    const out = buildInsights({ ...base, recordsThisWeek: [{ movementName: "Bench", label: "62.5 kg", movementId: 1 }] });
    expect(out[0].id).toBe("records");
  });
  it("flags lagging muscles only once the week is far enough along", () => {
    expect(ids({ muscles: { chest: 12, hamstrings: 2 } })).toContain("low-volume");
    expect(ids({ muscles: { chest: 12, hamstrings: 2 }, weekDayIndex: 1 })).not.toContain("low-volume");
  });
  it("compares push and pull", () => {
    expect(ids({ muscles: { chest: 16, shoulders: 6, lats: 4, upper_back: 3 } })).toContain("push-pull");
    expect(ids({ muscles: { chest: 10, lats: 10 } })).not.toContain("push-pull");
  });
  it("warns when strength drops during a cut", () => {
    const lifts = [{ movementId: 1, name: "Bench", changePct: -7, sessions: 5 }];
    const out = buildInsights({ ...base, lifts });
    expect(out.find((i) => i.id === "strength-down")?.tone).toBe("warn");
  });
  it("reassures when strength holds during a cut", () => {
    expect(ids({ lifts: [{ movementId: 1, name: "Bench", changePct: 1, sessions: 5 }] })).toContain("strength-held");
  });
  it("links nutrition to training", () => {
    expect(ids({ protein: { avg: 120, target: 162, days: 3 } })).toContain("protein");
    expect(ids({ protein: { avg: 160, target: 162, days: 3 } })).not.toContain("protein");
  });
  it("needs data before saying anything", () => {
    expect(buildInsights({ ...base, sessionsThisWeek: 0 })).toEqual([]);
  });
});
