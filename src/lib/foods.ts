import type { DB } from "./db";
import type { Nutrients } from "./nutrients";
import type { Portion } from "./units";

export type FoodSource = "fndds" | "foundation" | "sr" | "starter" | "custom";

export interface FoodSummary {
  id: number;
  name: string;
  source: FoodSource;
  category: string | null;
  kcalPer100g: number;
}

export interface Food extends FoodSummary {
  nutrients: Nutrients;
  portions: Portion[];
}

interface FoodRow {
  id: number;
  name: string;
  source: FoodSource;
  category: string | null;
  nutrients: string;
}

// FNDDS describes foods "as eaten" (e.g. "Egg, whole, fried"), so it ranks first for everyday phrasing.
const SOURCE_BONUS: Record<FoodSource, number> = { custom: 4, fndds: 1.5, foundation: 1, sr: 0, starter: -0.5 };

function ftsQuery(text: string, mode: "AND" | "OR"): string {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.map((w) => `"${w}"*`).join(mode === "AND" ? " " : " OR ");
}

function toSummary(r: FoodRow): FoodSummary {
  const n = JSON.parse(r.nutrients) as Nutrients;
  return { id: r.id, name: r.name, source: r.source, category: r.category, kcalPer100g: n.kcal ?? 0 };
}

export function searchFoods(db: DB, text: string, limit = 20): FoodSummary[] {
  const stmt = db.prepare(
    `SELECT f.id, f.name, f.source, f.category, f.nutrients, bm25(foods_fts) AS rank,
            (SELECT count(*) FROM entries e WHERE e.food_id = f.id) AS uses
       FROM foods_fts JOIN foods f ON f.id = foods_fts.rowid
      WHERE foods_fts MATCH ? ORDER BY rank LIMIT 300`,
  );
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const stems = words.map((w) => w.replace(/(es|s)$/, ""));
  for (const mode of ["AND", "OR"] as const) {
    const q = ftsQuery(text, mode);
    if (!q) return [];
    const rows = stmt.all(q) as (FoodRow & { rank: number; uses: number })[];
    if (rows.length === 0) continue;
    const scored = rows.map((r) => {
      const name = r.name.toLowerCase();
      const nameWords = new Set((name.match(/[a-z0-9]+/g) ?? []).map((w) => w.replace(/(es|s)$/, "")));
      const head = name.split(",")[0].replace(/(es|s)$/, "");
      const wholeWordHits = stems.filter((s) => nameWords.has(s)).length;
      const score =
        -r.rank +
        SOURCE_BONUS[r.source] +
        Math.log1p(r.uses) * 2 +
        wholeWordHits * 1.5 +
        (stems.includes(head) || head === stems.join(" ") ? 2 : 0) +
        (/\b(raw|nfs|plain)\b/.test(name) ? 0.5 : 0) -
        name.length / 30;
      return { r, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ r }) => toSummary(r));
  }
  return [];
}

/** The user's own foods matching any query word, so they stay candidates for USDA-style queries. */
export function searchCustomFoods(db: DB, text: string): FoodSummary[] {
  const q = ftsQuery(text, "OR");
  if (!q) return [];
  const rows = db
    .prepare(
      `SELECT f.id, f.name, f.source, f.category, f.nutrients
         FROM foods_fts JOIN foods f ON f.id = foods_fts.rowid
        WHERE foods_fts MATCH ? AND f.source = 'custom' ORDER BY bm25(foods_fts) LIMIT 5`,
    )
    .all(q) as FoodRow[];
  return rows.map(toSummary);
}

export function getFood(db: DB, id: number): Food | null {
  const r = db.prepare("SELECT id, name, source, category, nutrients FROM foods WHERE id = ?").get(id) as
    | FoodRow
    | undefined;
  if (!r) return null;
  const portions = db
    .prepare("SELECT label, grams FROM portions WHERE food_id = ? ORDER BY id")
    .all(id) as Portion[];
  return { ...toSummary(r), nutrients: JSON.parse(r.nutrients) as Nutrients, portions };
}

export interface CustomFoodInput {
  name: string;
  /** Nutrients for one serving of `servingGrams`. */
  nutrients: Nutrients;
  servingGrams: number;
  servingLabel: string;
}

export function createCustomFood(db: DB, input: CustomFoodInput): number {
  const per100 = Object.fromEntries(
    Object.entries(input.nutrients).map(([k, v]) => [k, (v * 100) / input.servingGrams]),
  );
  return db.transaction(() => {
    const { id } = db.prepare("SELECT max(id, 100000000) + 1 AS id FROM (SELECT max(id) AS id FROM foods)").get() as {
      id: number;
    };
    db.prepare("INSERT INTO foods (id, source, name, category, nutrients) VALUES (?, 'custom', ?, 'Custom', ?)").run(
      id,
      input.name,
      JSON.stringify(per100),
    );
    db.prepare("INSERT INTO portions (food_id, label, grams) VALUES (?, ?, ?)").run(
      id,
      `1 ${input.servingLabel}`,
      input.servingGrams,
    );
    return id;
  })();
}
