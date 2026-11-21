import { describe, expect, it } from "vitest";
import { gramsFor, parsePortionLabel } from "./units";

const egg = [
  { label: "1 cup", grams: 243 },
  { label: "1 large", grams: 50 },
  { label: "1 medium", grams: 44 },
];
const broccoli = [
  { label: "1 cup chopped", grams: 91 },
  { label: "0.5 cup, chopped or diced", grams: 44 },
  { label: "1 spear (about 5\" long)", grams: 31 },
];
const milk = [{ label: "1 cup", grams: 244 }, { label: "1 fl oz", grams: 30.5 }];

describe("parsePortionLabel", () => {
  it("reads leading numbers, decimals, and fractions", () => {
    expect(parsePortionLabel("1 cup")).toEqual({ amount: 1, rest: "cup" });
    expect(parsePortionLabel("0.5 cup, chopped")).toEqual({ amount: 0.5, rest: "cup, chopped" });
    expect(parsePortionLabel("1/2 cup")).toEqual({ amount: 0.5, rest: "cup" });
    expect(parsePortionLabel("slice")).toEqual({ amount: 1, rest: "slice" });
  });
});

describe("gramsFor", () => {
  it("handles mass units directly", () => {
    expect(gramsFor(150, "g", egg).grams).toBe(150);
    expect(gramsFor(2, "oz", egg).grams).toBeCloseTo(56.7, 1);
    expect(gramsFor(1, "lb", egg).grams).toBeCloseTo(453.6, 1);
  });

  it("uses a matching household portion", () => {
    expect(gramsFor(2, "large", egg).grams).toBe(100);
    expect(gramsFor(3, "spear", broccoli).grams).toBe(93);
  });

  it("matches unit synonyms and plurals (cups, tablespoon → tbsp)", () => {
    expect(gramsFor(2, "cups", broccoli).grams).toBe(182);
  });

  it("divides by the portion's own amount", () => {
    const r = gramsFor(1, "cup", [{ label: "0.5 cup, chopped", grams: 44 }]);
    expect(r.grams).toBe(88);
  });

  it("converts between volume units using the food's density", () => {
    // milk: 244 g per cup → 1 tbsp = 244 / 16
    expect(gramsFor(1, "tbsp", milk).grams).toBeCloseTo(15.3, 1);
  });

  it("falls back to water density for volume with no portions", () => {
    expect(gramsFor(250, "ml", []).grams).toBe(250);
    expect(gramsFor(1, "cup", []).grams).toBeCloseTo(236.6, 0);
  });

  it("uses the first count-style portion for unitless counts", () => {
    expect(gramsFor(2, "", egg).grams).toBe(100);
    expect(gramsFor(2, "egg", egg).grams).toBe(100);
  });

  it("prefers a portion whose label starts with the unit", () => {
    const milkOdd = [{ label: "Guideline amount per cup of hot cereal", grams: 61 }, { label: "1 cup", grams: 244 }];
    expect(gramsFor(1, "cup", milkOdd).grams).toBe(244);
  });

  it("among several matching portions, picks the one closest to the estimate", () => {
    const bread = [
      { label: "1 slice, snack-size", grams: 9 },
      { label: "1 medium or regular slice", grams: 33 },
      { label: "1 slice, crust not eaten", grams: 15 },
    ];
    expect(gramsFor(1, "slice", bread, 30).grams).toBe(33);
  });

  it("picks the count portion closest to the estimate", () => {
    const banana = [
      { label: "1 extra small", grams: 81 },
      { label: "1 medium", grams: 118 },
      { label: "1 large", grams: 136 },
    ];
    expect(gramsFor(1, "", banana, 120).grams).toBe(118);
    expect(gramsFor(2, "", banana, 280).grams).toBe(272);
  });

  it("trusts the estimate over a portion that is wildly off", () => {
    const broccoli = [{ label: "1 floweret", grams: 10 }];
    expect(gramsFor(1, "", broccoli, 90)).toEqual({ grams: 90, basis: "estimate" });
    // Explicit mass is never overridden.
    expect(gramsFor(10, "g", broccoli, 90).grams).toBe(10);
  });

  it("uses the estimate when nothing matches", () => {
    const r = gramsFor(1, "bowl", [], 300);
    expect(r).toEqual({ grams: 300, basis: "estimate" });
  });
});
