// Nutrient catalogue: keys used across the app, USDA source ids, and FDA Daily Values (adults).

export type NutrientGroup = "macro" | "fat" | "carb" | "vitamin" | "mineral" | "other";

export interface NutrientDef {
  key: string;
  label: string;
  unit: "kcal" | "g" | "mg" | "µg";
  group: NutrientGroup;
  /** USDA nutrient ids in priority order; first one present wins. */
  usdaIds: number[];
  /** FDA Daily Value; undefined when there is no single DV. */
  dv?: number;
  /** True when the DV is a ceiling ("less than"), not a target. */
  limit?: boolean;
}

export const NUTRIENTS: readonly NutrientDef[] = [
  { key: "kcal", label: "Calories", unit: "kcal", group: "macro", usdaIds: [1008, 2048, 2047] },
  { key: "protein", label: "Protein", unit: "g", group: "macro", usdaIds: [1003], dv: 50 },
  { key: "carbs", label: "Carbs", unit: "g", group: "macro", usdaIds: [1005, 1050], dv: 275 },
  { key: "fat", label: "Fat", unit: "g", group: "macro", usdaIds: [1004], dv: 78 },
  { key: "fiber", label: "Fiber", unit: "g", group: "carb", usdaIds: [1079], dv: 28 },
  { key: "sugar", label: "Sugars", unit: "g", group: "carb", usdaIds: [2000, 1063] },
  { key: "addedSugar", label: "Added sugars", unit: "g", group: "carb", usdaIds: [1235], dv: 50, limit: true },
  { key: "satFat", label: "Saturated fat", unit: "g", group: "fat", usdaIds: [1258], dv: 20, limit: true },
  { key: "monoFat", label: "Monounsaturated fat", unit: "g", group: "fat", usdaIds: [1292] },
  { key: "polyFat", label: "Polyunsaturated fat", unit: "g", group: "fat", usdaIds: [1293] },
  { key: "transFat", label: "Trans fat", unit: "g", group: "fat", usdaIds: [1257] },
  { key: "omega3Ala", label: "Omega-3 (ALA)", unit: "g", group: "fat", usdaIds: [1404, 1270], dv: 1.6 },
  { key: "omega3Epa", label: "Omega-3 (EPA)", unit: "g", group: "fat", usdaIds: [1278] },
  { key: "omega3Dha", label: "Omega-3 (DHA)", unit: "g", group: "fat", usdaIds: [1272] },
  { key: "cholesterol", label: "Cholesterol", unit: "mg", group: "fat", usdaIds: [1253], dv: 300, limit: true },
  { key: "sodium", label: "Sodium", unit: "mg", group: "mineral", usdaIds: [1093], dv: 2300, limit: true },
  { key: "potassium", label: "Potassium", unit: "mg", group: "mineral", usdaIds: [1092], dv: 4700 },
  { key: "calcium", label: "Calcium", unit: "mg", group: "mineral", usdaIds: [1087], dv: 1300 },
  { key: "iron", label: "Iron", unit: "mg", group: "mineral", usdaIds: [1089], dv: 18 },
  { key: "magnesium", label: "Magnesium", unit: "mg", group: "mineral", usdaIds: [1090], dv: 420 },
  { key: "phosphorus", label: "Phosphorus", unit: "mg", group: "mineral", usdaIds: [1091], dv: 1250 },
  { key: "zinc", label: "Zinc", unit: "mg", group: "mineral", usdaIds: [1095], dv: 11 },
  { key: "copper", label: "Copper", unit: "mg", group: "mineral", usdaIds: [1098], dv: 0.9 },
  { key: "manganese", label: "Manganese", unit: "mg", group: "mineral", usdaIds: [1101], dv: 2.3 },
  { key: "selenium", label: "Selenium", unit: "µg", group: "mineral", usdaIds: [1103], dv: 55 },
  { key: "vitA", label: "Vitamin A", unit: "µg", group: "vitamin", usdaIds: [1106], dv: 900 },
  { key: "vitC", label: "Vitamin C", unit: "mg", group: "vitamin", usdaIds: [1162], dv: 90 },
  { key: "vitD", label: "Vitamin D", unit: "µg", group: "vitamin", usdaIds: [1114], dv: 20 },
  { key: "vitE", label: "Vitamin E", unit: "mg", group: "vitamin", usdaIds: [1109], dv: 15 },
  { key: "vitK", label: "Vitamin K", unit: "µg", group: "vitamin", usdaIds: [1185], dv: 120 },
  { key: "thiamin", label: "Thiamin (B1)", unit: "mg", group: "vitamin", usdaIds: [1165], dv: 1.2 },
  { key: "riboflavin", label: "Riboflavin (B2)", unit: "mg", group: "vitamin", usdaIds: [1166], dv: 1.3 },
  { key: "niacin", label: "Niacin (B3)", unit: "mg", group: "vitamin", usdaIds: [1167], dv: 16 },
  { key: "pantothenic", label: "Pantothenic acid (B5)", unit: "mg", group: "vitamin", usdaIds: [1170], dv: 5 },
  { key: "vitB6", label: "Vitamin B6", unit: "mg", group: "vitamin", usdaIds: [1175], dv: 1.7 },
  { key: "folate", label: "Folate", unit: "µg", group: "vitamin", usdaIds: [1190, 1177], dv: 400 },
  { key: "vitB12", label: "Vitamin B12", unit: "µg", group: "vitamin", usdaIds: [1178], dv: 2.4 },
  { key: "choline", label: "Choline", unit: "mg", group: "vitamin", usdaIds: [1180], dv: 550 },
  { key: "water", label: "Water", unit: "g", group: "other", usdaIds: [1051] },
  { key: "caffeine", label: "Caffeine", unit: "mg", group: "other", usdaIds: [1057], dv: 400, limit: true },
  { key: "alcohol", label: "Alcohol", unit: "g", group: "other", usdaIds: [1018] },
];

export type Nutrients = Record<string, number>;

/** Scale a per-100 g nutrient profile to a given gram amount. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100;
  return Object.fromEntries(Object.entries(per100g).map(([k, v]) => [k, v * factor]));
}

/** Sum nutrient profiles. Keys missing from a profile count as 0. */
export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const [k, v] of Object.entries(n)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** Pick one value per nutrient key from raw USDA id → amount pairs, honouring priority order. */
export function fromUsda(raw: ReadonlyMap<number, number>): Nutrients {
  const out: Nutrients = {};
  for (const def of NUTRIENTS) {
    const id = def.usdaIds.find((i) => raw.has(i));
    if (id !== undefined) out[def.key] = raw.get(id)!;
  }
  return out;
}

/** Percent of Daily Value, or null when the nutrient has no DV. */
export function percentDv(key: string, amount: number): number | null {
  const def = NUTRIENTS.find((n) => n.key === key);
  return def?.dv ? (amount / def.dv) * 100 : null;
}
