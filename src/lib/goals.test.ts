import { describe, expect, it } from "vitest";
import { bmr, computeTargets, type Profile } from "./goals";

const base: Profile = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
  weeklyChangeKg: 0,
  proteinPerKg: 1.8,
  fatPct: 30,
};

describe("bmr (Mifflin-St Jeor)", () => {
  it("matches the published formula for men", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(bmr(base)).toBe(1780);
  });

  it("matches the published formula for women", () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 1330.25
    expect(bmr({ ...base, sex: "female", weightKg: 60, heightCm: 165, age: 28 })).toBeCloseTo(1330.25);
  });
});

describe("computeTargets", () => {
  it("maintenance = BMR × activity multiplier", () => {
    const t = computeTargets(base);
    expect(t.tdee).toBe(Math.round(1780 * 1.55));
    expect(t.kcal).toBe(t.tdee);
  });

  it("applies a deficit of 7700 kcal per kg per week", () => {
    const t = computeTargets({ ...base, weeklyChangeKg: -0.5 });
    expect(t.kcal).toBe(t.tdee - 550);
  });

  it("splits macros: protein by bodyweight, fat by %, carbs fill the rest", () => {
    const t = computeTargets(base);
    expect(t.protein).toBe(144); // 1.8 * 80
    expect(t.fat).toBe(Math.round((t.kcal * 0.3) / 9));
    expect(t.carbs).toBe(Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4));
  });

  it("never sets carbs below zero", () => {
    const t = computeTargets({ ...base, proteinPerKg: 4, fatPct: 60, weeklyChangeKg: -1 });
    expect(t.carbs).toBe(0);
  });

  it("uses an explicit calorie override when given", () => {
    const t = computeTargets({ ...base, kcalOverride: 2000 });
    expect(t.kcal).toBe(2000);
  });
});
