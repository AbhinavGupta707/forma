import { describe, expect, it } from "vitest";
import { fromUsda, percentDv, scaleNutrients, sumNutrients } from "./nutrients";

describe("nutrients", () => {
  it("scales per-100 g values", () => {
    expect(scaleNutrients({ kcal: 200, protein: 10 }, 50)).toEqual({ kcal: 100, protein: 5 });
  });

  it("sums profiles with missing keys as zero", () => {
    expect(sumNutrients([{ kcal: 100, fiber: 2 }, { kcal: 50, protein: 3 }])).toEqual({
      kcal: 150,
      fiber: 2,
      protein: 3,
    });
  });

  it("does not mutate inputs", () => {
    const a = { kcal: 100 };
    sumNutrients([a, { kcal: 1 }]);
    scaleNutrients(a, 200);
    expect(a).toEqual({ kcal: 100 });
  });

  it("prefers the first USDA id present (energy 1008 over Atwater 2048)", () => {
    expect(fromUsda(new Map([[2048, 90], [1008, 100]])).kcal).toBe(100);
    expect(fromUsda(new Map([[2048, 90], [2047, 95]])).kcal).toBe(90);
  });

  it("computes % daily value, null when no DV", () => {
    expect(percentDv("sodium", 1150)).toBe(50);
    expect(percentDv("kcal", 500)).toBeNull();
  });
});
