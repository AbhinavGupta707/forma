// Converts a spoken quantity + unit into grams using a food's household portions.

export interface Portion {
  label: string;
  grams: number;
}

export interface GramsResult {
  grams: number;
  /** What the conversion was based on: "mass", a portion label, "volume", "estimate" or "default". */
  basis: string;
}

const MASS_G: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, oz: 28.3495, lb: 453.592 };
const VOLUME_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.929,
  tbsp: 14.787,
  cup: 236.588,
  floz: 29.574,
};
const COUNT_WORDS = new Set(["", "piece", "pc", "whole", "item", "each", "unit", "x", "serving"]);

const SYNONYMS: Record<string, string> = {
  gram: "g", gm: "g", gr: "g",
  kilogram: "kg", kilo: "kg",
  ounce: "oz",
  pound: "lb", lbs: "lb",
  milliliter: "ml", millilitre: "ml",
  liter: "l", litre: "l",
  tablespoon: "tbsp", tbs: "tbsp", tbl: "tbsp", t: "tbsp",
  teaspoon: "tsp",
  pc: "piece",
};

function normalizeToken(raw: string): string {
  const t = raw.toLowerCase();
  const singular = t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t;
  return SYNONYMS[t] ?? SYNONYMS[singular] ?? singular;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/fl\.?\s*oz|fluid ounces?/g, "floz")
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(normalizeToken);
}

export function normalizeUnit(unit: string): string {
  return tokens(unit).join(" ");
}

/** Split "0.5 cup, chopped" into { amount: 0.5, rest: "cup, chopped" }. */
export function parsePortionLabel(label: string): { amount: number; rest: string } {
  const m = label.trim().match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*(.*)$/);
  if (!m) return { amount: 1, rest: label.trim() };
  const amount = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
  return { amount: amount || 1, rest: m[3] };
}

function gramsPerUnit(p: Portion): { perUnit: number; words: string[] } {
  const { amount, rest } = parsePortionLabel(p.label);
  return { perUnit: p.grams / amount, words: tokens(rest) };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A portion-based answer this far from the model's own estimate is treated as a bad portion match. */
const PLAUSIBLE_RATIO: [number, number] = [0.4, 2.5];

export function gramsFor(
  quantity: number,
  unit: string,
  portions: readonly Portion[],
  estimateGrams?: number,
): GramsResult {
  const r = portionGrams(quantity, unit, portions, estimateGrams);
  if (r.basis === "mass" || r.basis === "estimate" || !estimateGrams) return r;
  const ratio = r.grams / estimateGrams;
  return ratio < PLAUSIBLE_RATIO[0] || ratio > PLAUSIBLE_RATIO[1] ? { grams: round1(estimateGrams), basis: "estimate" } : r;
}

function portionGrams(
  quantity: number,
  unit: string,
  portions: readonly Portion[],
  estimateGrams?: number,
): GramsResult {
  const u = normalizeUnit(unit);

  if (u in MASS_G) return { grams: round1(quantity * MASS_G[u]), basis: "mass" };

  const parsed = portions.map((p) => ({ p, ...gramsPerUnit(p) }));
  const target = estimateGrams !== undefined ? estimateGrams / quantity : undefined;
  type Parsed = (typeof parsed)[number];
  const closest = (list: Parsed[]): Parsed | undefined =>
    target === undefined
      ? list[0]
      : list.toSorted((a, b) => Math.abs(a.perUnit - target) - Math.abs(b.perUnit - target))[0];

  if (u) {
    // With an estimate, any portion mentioning the unit competes ("1 medium or regular slice");
    // without one, prefer labels that start with it ("1 cup" over "per cup of hot cereal").
    const mentioning = parsed.filter((x) => x.words.includes(u));
    const leading = mentioning.filter((x) => x.words[0] === u);
    const direct = closest(target === undefined && leading.length ? leading : mentioning);
    if (direct) return { grams: round1(quantity * direct.perUnit), basis: direct.p.label };
  }

  if (u in VOLUME_ML) {
    const ref = parsed.find((x) => x.words.some((w) => w in VOLUME_ML));
    const density = ref ? ref.perUnit / VOLUME_ML[ref.words.find((w) => w in VOLUME_ML)!] : 1;
    return { grams: round1(quantity * VOLUME_ML[u] * density), basis: "volume" };
  }

  if (COUNT_WORDS.has(u) || estimateGrams === undefined) {
    const count = closest(parsed.filter((x) => !x.words.some((w) => w in VOLUME_ML || w in MASS_G)));
    if (count) return { grams: round1(quantity * count.perUnit), basis: count.p.label };
  }

  if (estimateGrams !== undefined) return { grams: round1(estimateGrams), basis: "estimate" };
  return { grams: round1(quantity * 100), basis: "default" };
}
