import type { DB } from "./db";

export const STARTER_FOOD_IDS = {
  oats: 90_000_001,
  yogurt: 90_000_002,
  blueberries: 90_000_003,
  banana: 90_000_004,
  egg: 90_000_005,
  bread: 90_000_006,
  rice: 90_000_007,
  chickpeas: 90_000_008,
  broccoli: 90_000_009,
  chicken: 90_000_010,
  tofu: 90_000_011,
  apple: 90_000_012,
  oliveOil: 90_000_013,
  salmon: 90_000_014,
} as const;

type Food = [
  id: number, name: string, portion: string, grams: number,
  kcal: number, protein: number, carbs: number, fat: number, fiber: number,
];

const f = STARTER_FOOD_IDS;
// Approximate nutrient values per 100 g for exploring the app.
const foods: Food[] = [
  [f.oats, "Rolled oats, dry", "1 serving", 40, 379, 13.2, 67.7, 6.5, 10.1],
  [f.yogurt, "Greek yogurt, plain", "1 pot", 150, 59, 10.2, 3.6, 0.4, 0],
  [f.blueberries, "Blueberries", "1 cup", 148, 57, 0.7, 14.5, 0.3, 2.4],
  [f.banana, "Banana", "1 medium", 118, 89, 1.1, 22.8, 0.3, 2.6],
  [f.egg, "Egg, whole", "1 large", 50, 143, 12.6, 0.7, 9.5, 0],
  [f.bread, "Whole-wheat bread", "1 slice", 32, 252, 12.5, 43.1, 3.5, 6],
  [f.rice, "Brown rice, cooked", "1 cup", 195, 123, 2.7, 25.6, 1, 1.6],
  [f.chickpeas, "Chickpeas, cooked", "1 cup", 164, 164, 8.9, 27.4, 2.6, 7.6],
  [f.broccoli, "Broccoli", "1 serving", 80, 34, 2.8, 6.6, 0.4, 2.6],
  [f.chicken, "Chicken breast, cooked", "1 serving", 120, 165, 31, 0, 3.6, 0],
  [f.tofu, "Tofu, firm", "1 serving", 100, 144, 17.3, 2.8, 8.7, 2.3],
  [f.apple, "Apple", "1 medium", 182, 52, 0.3, 13.8, 0.2, 2.4],
  [f.oliveOil, "Olive oil", "1 tablespoon", 14, 884, 0, 0, 100, 0],
  [f.salmon, "Salmon, cooked", "1 serving", 120, 206, 22.1, 0, 12.4, 0],
];

export function seedStarterFoods(db: DB): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO foods (id, source, name, category, nutrients) VALUES (?, 'starter', ?, 'Starter foods', ?)",
  );
  const addPortion = db.prepare("INSERT INTO portions (food_id, label, grams) VALUES (?, ?, ?)");
  db.transaction(() => {
    for (const [id, name, portion, grams, kcal, protein, carbs, fat, fiber] of foods) {
      const { changes } = insert.run(id, name, JSON.stringify({ kcal, protein, carbs, fat, fiber }));
      if (changes) addPortion.run(id, portion, grams);
    }
  })();
}
