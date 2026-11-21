// Imports USDA FoodData Central CSV datasets (FNDDS, Foundation, SR Legacy) into the Forma database.
// Usage: npm run import:usda   (expects unzipped datasets under data/usda/)
import { parse } from "csv-parse";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { fromUsda } from "../src/lib/nutrients";

type Row = Record<string, string>;

interface Dataset {
  source: "fndds" | "foundation" | "sr";
  dirPrefix: string;
  dataType: string;
}

const DATASETS: Dataset[] = [
  { source: "fndds", dirPrefix: "FoodData_Central_survey_food_csv", dataType: "survey_fndds_food" },
  { source: "foundation", dirPrefix: "FoodData_Central_foundation_food_csv", dataType: "foundation_food" },
  { source: "sr", dirPrefix: "FoodData_Central_sr_legacy_food_csv", dataType: "sr_legacy_food" },
];

const USDA_DIR = path.join(process.cwd(), "data", "usda");

async function* rows(file: string): AsyncGenerator<Row> {
  yield* fs.createReadStream(file).pipe(parse({ columns: true, bom: true, relax_quotes: true }));
}

async function readAll(file: string): Promise<Row[]> {
  const out: Row[] = [];
  for await (const r of rows(file)) out.push(r);
  return out;
}

/** Locate the CSV folder for a dataset (zips unpack to <name>/<name>/). */
function datasetDir(prefix: string): string {
  const top = fs.readdirSync(USDA_DIR).find((d) => d.startsWith(prefix));
  if (!top) throw new Error(`Dataset ${prefix}* not found in ${USDA_DIR}`);
  const nested = path.join(USDA_DIR, top, top);
  return fs.existsSync(nested) ? nested : path.join(USDA_DIR, top);
}

function portionLabel(r: Row, units: Map<string, string>): string {
  if (r.portion_description) return r.portion_description.trim();
  const unit = units.get(r.measure_unit_id);
  const parts = [r.amount, unit && unit !== "undetermined" ? unit : ""].filter(Boolean).join(" ");
  return [parts, r.modifier].filter(Boolean).join(parts && unit && unit !== "undetermined" ? ", " : " ").trim();
}

async function importDataset(ds: Dataset): Promise<number> {
  const dir = datasetDir(ds.dirPrefix);
  const db = getDb();

  // FNDDS references nutrients by legacy nutrient_nbr; map those back to modern ids.
  const nbrToId = new Map<string, number>();
  for (const n of await readAll(path.join(dir, "nutrient.csv"))) {
    if (n.nutrient_nbr) nbrToId.set(String(Math.round(Number(n.nutrient_nbr))), Number(n.id));
  }
  const nutrientId = (raw: string): number =>
    Number(raw) >= 1000 ? Number(raw) : (nbrToId.get(raw) ?? -1);

  const categories = new Map<string, string>();
  for (const file of ["food_category.csv", "wweia_food_category.csv"]) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) continue;
    for (const c of await readAll(p)) {
      categories.set(c.id ?? c.wweia_food_category, c.description ?? c.wweia_food_category_description);
    }
  }

  const foods = new Map<string, { name: string; category?: string }>();
  for await (const f of rows(path.join(dir, "food.csv"))) {
    if (f.data_type === ds.dataType) {
      foods.set(f.fdc_id, { name: f.description.trim(), category: categories.get(f.food_category_id) });
    }
  }

  const raw = new Map<string, Map<number, number>>();
  for await (const n of rows(path.join(dir, "food_nutrient.csv"))) {
    if (!foods.has(n.fdc_id) || n.amount === "") continue;
    let m = raw.get(n.fdc_id);
    if (!m) raw.set(n.fdc_id, (m = new Map()));
    m.set(nutrientId(n.nutrient_id), Number(n.amount));
  }

  const units = new Map((await readAll(path.join(dir, "measure_unit.csv"))).map((u) => [u.id, u.name]));
  const portions = (await readAll(path.join(dir, "food_portion.csv"))).filter(
    (p) => foods.has(p.fdc_id) && Number(p.gram_weight) > 0 && p.portion_description !== "Quantity not specified",
  );

  const insertFood = db.prepare(
    `INSERT INTO foods (id, source, name, category, nutrients) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET source = excluded.source, name = excluded.name,
       category = excluded.category, nutrients = excluded.nutrients`,
  );
  const insertPortion = db.prepare("INSERT INTO portions (food_id, label, grams) VALUES (?, ?, ?)");
  const inserted = new Set<string>();
  db.transaction(() => {
    for (const [fdcId, f] of foods) {
      const nutrients = fromUsda(raw.get(fdcId) ?? new Map());
      if (nutrients.kcal === undefined) continue; // unusable without energy
      db.prepare("DELETE FROM portions WHERE food_id = ?").run(fdcId);
      insertFood.run(Number(fdcId), ds.source, f.name, f.category ?? null, JSON.stringify(nutrients));
      inserted.add(fdcId);
    }
    for (const p of portions) {
      if (!inserted.has(p.fdc_id)) continue;
      const label = portionLabel(p, units);
      if (label) insertPortion.run(Number(p.fdc_id), label, Number(p.gram_weight));
    }
  })();
  return inserted.size;
}

async function main(): Promise<void> {
  for (const ds of DATASETS) {
    const n = await importDataset(ds);
    process.stdout.write(`${ds.source}: ${n} foods\n`);
  }
  const db = getDb();
  db.exec("INSERT INTO foods_fts(foods_fts) VALUES ('optimize')");
  const { c } = db.prepare("SELECT count(*) c FROM portions").get() as { c: number };
  process.stdout.write(`portions: ${c}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`Import failed: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
