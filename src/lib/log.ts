import type { DB } from "./db";
import { addDays, type Meal, MEALS } from "./dates";
import { getFood } from "./foods";
import { computeTargets, type Targets } from "./goals";
import { type Nutrients, scaleNutrients, sumNutrients } from "./nutrients";
import { getRecipe } from "./recipes";
import { getPrefs, getProfile, isProfileSet } from "./settings";

export interface Entry {
  id: number;
  date: string;
  meal: Meal;
  label: string;
  foodId: number | null;
  recipeId: number | null;
  grams: number | null;
  servings: number | null;
  nutrients: Nutrients;
}

export interface ExerciseEntry {
  workoutId: number | null;
  id: number;
  date: string;
  label: string;
  minutes: number | null;
  kcal: number;
}

export type EntryInput =
  | { kind: "food"; date: string; meal: Meal; foodId: number; grams: number }
  | { kind: "recipe"; date: string; meal: Meal; recipeId: number; servings: number }
  | { kind: "quick"; date: string; meal: Meal; label: string; nutrients: Nutrients };

export class NotFoundError extends Error {}

interface EntryRow {
  id: number;
  date: string;
  meal: Meal;
  label: string;
  food_id: number | null;
  recipe_id: number | null;
  grams: number | null;
  servings: number | null;
  nutrients: string;
}

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  date: r.date,
  meal: r.meal,
  label: r.label,
  foodId: r.food_id,
  recipeId: r.recipe_id,
  grams: r.grams,
  servings: r.servings,
  nutrients: JSON.parse(r.nutrients) as Nutrients,
});

/** Resolve label + nutrient snapshot for an entry. Snapshots keep history stable if a recipe changes later. */
function resolve(db: DB, input: EntryInput): Omit<EntryRow, "id"> {
  if (input.kind === "food") {
    const food = getFood(db, input.foodId);
    if (!food) throw new NotFoundError(`Food ${input.foodId} not found`);
    return { date: input.date, meal: input.meal, label: food.name, food_id: food.id, recipe_id: null,
      grams: input.grams, servings: null, nutrients: JSON.stringify(scaleNutrients(food.nutrients, input.grams)) };
  }
  if (input.kind === "recipe") {
    const recipe = getRecipe(db, input.recipeId);
    if (!recipe) throw new NotFoundError(`Recipe ${input.recipeId} not found`);
    return { date: input.date, meal: input.meal, label: recipe.name, food_id: null, recipe_id: recipe.id,
      grams: null, servings: input.servings,
      nutrients: JSON.stringify(scaleNutrients(recipe.perServing, input.servings * 100)) };
  }
  return { date: input.date, meal: input.meal, label: input.label, food_id: null, recipe_id: null,
    grams: null, servings: null, nutrients: JSON.stringify(input.nutrients) };
}

export function addEntries(db: DB, inputs: readonly EntryInput[]): number[] {
  const insert = db.prepare(
    `INSERT INTO entries (date, meal, label, food_id, recipe_id, grams, servings, nutrients)
     VALUES (@date, @meal, @label, @food_id, @recipe_id, @grams, @servings, @nutrients)`,
  );
  return db.transaction(() => inputs.map((i) => Number(insert.run(resolve(db, i)).lastInsertRowid)))();
}

export function getEntry(db: DB, id: number): Entry | null {
  const r = db.prepare("SELECT * FROM entries WHERE id = ?").get(id) as EntryRow | undefined;
  return r ? toEntry(r) : null;
}

/** Change amount or meal; nutrients are recomputed from the source food/recipe. */
export function updateEntry(db: DB, id: number, change: { grams?: number; servings?: number; meal?: Meal }): void {
  const e = getEntry(db, id);
  if (!e) throw new NotFoundError(`Entry ${id} not found`);
  const meal = change.meal ?? e.meal;
  let next: Omit<EntryRow, "id">;
  if (e.foodId !== null) {
    next = resolve(db, { kind: "food", date: e.date, meal, foodId: e.foodId, grams: change.grams ?? e.grams ?? 100 });
  } else if (e.recipeId !== null) {
    next = resolve(db, { kind: "recipe", date: e.date, meal, recipeId: e.recipeId,
      servings: change.servings ?? e.servings ?? 1 });
  } else {
    next = resolve(db, { kind: "quick", date: e.date, meal, label: e.label, nutrients: e.nutrients });
  }
  db.prepare("UPDATE entries SET meal = ?, grams = ?, servings = ?, nutrients = ? WHERE id = ?").run(
    next.meal, next.grams, next.servings, next.nutrients, id);
}

export function deleteEntry(db: DB, id: number): void {
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
}

export function addExercise(db: DB, e: Omit<ExerciseEntry, "id" | "workoutId">): number {
  return Number(
    db.prepare("INSERT INTO exercises (date, label, minutes, kcal) VALUES (?, ?, ?, ?)").run(
      e.date, e.label, e.minutes, e.kcal).lastInsertRowid,
  );
}

export function deleteExercise(db: DB, id: number): void {
  db.prepare("DELETE FROM exercises WHERE id = ?").run(id);
}

/** Copy all entries of a meal from one day to another (e.g. "same breakfast as yesterday"). */
export function copyMeal(db: DB, fromDate: string, toDate: string, meal: Meal): number {
  return db
    .prepare(
      `INSERT INTO entries (date, meal, label, food_id, recipe_id, grams, servings, nutrients)
       SELECT ?, meal, label, food_id, recipe_id, grams, servings, nutrients
         FROM entries WHERE date = ? AND meal = ? ORDER BY id`,
    )
    .run(toDate, fromDate, meal).changes;
}

export interface DaySummary {
  date: string;
  meals: Record<Meal, Entry[]>;
  exercises: ExerciseEntry[];
  totals: Nutrients;
  exerciseKcal: number;
  targets: Targets;
  /** Calorie budget for the day (target + exercise when enabled). */
  budget: number;
  remaining: number;
  profileSet: boolean;
}

export function getDay(db: DB, date: string): DaySummary {
  const entries = (db.prepare("SELECT * FROM entries WHERE date = ? ORDER BY id").all(date) as EntryRow[]).map(toEntry);
  const exercises = db
    .prepare("SELECT id, date, label, minutes, kcal, workout_id AS workoutId FROM exercises WHERE date = ? ORDER BY id")
    .all(date) as ExerciseEntry[];
  const meals = Object.fromEntries(MEALS.map((m) => [m, entries.filter((e) => e.meal === m)])) as Record<Meal, Entry[]>;
  const totals = sumNutrients(entries.map((e) => e.nutrients));
  const exerciseKcal = exercises.reduce((s, e) => s + e.kcal, 0);
  const targets = computeTargets(getProfile(db));
  const budget = targets.kcal + (getPrefs(db).addExerciseBack ? exerciseKcal : 0);
  return {
    date, meals, exercises, totals, exerciseKcal, targets, budget,
    remaining: Math.round(budget - (totals.kcal ?? 0)),
    profileSet: isProfileSet(db),
  };
}

export interface RecentItem {
  kind: "food" | "recipe";
  id: number;
  label: string;
  grams: number | null;
  servings: number | null;
  kcal: number;
}

/** Most recently logged distinct foods/recipes, with the last amount used. */
export function recentItems(db: DB, limit = 15): RecentItem[] {
  const rows = db
    .prepare(
      `SELECT food_id, recipe_id, label, grams, servings, nutrients, max(id) AS last
         FROM entries WHERE food_id IS NOT NULL OR recipe_id IS NOT NULL
        GROUP BY coalesce(food_id, -recipe_id) ORDER BY last DESC LIMIT ?`,
    )
    .all(limit) as (EntryRow & { last: number })[];
  return rows.map((r) => ({
    kind: r.food_id !== null ? "food" : "recipe",
    id: (r.food_id ?? r.recipe_id)!,
    label: r.label,
    grams: r.grams,
    servings: r.servings,
    kcal: Math.round((JSON.parse(r.nutrients) as Nutrients).kcal ?? 0),
  }));
}

export interface TrendDay {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  exerciseKcal: number;
  weightKg: number | null;
}

export function trends(db: DB, from: string, to: string): TrendDay[] {
  const food = db
    .prepare("SELECT date, nutrients FROM entries WHERE date BETWEEN ? AND ?")
    .all(from, to) as { date: string; nutrients: string }[];
  const ex = db
    .prepare("SELECT date, sum(kcal) AS kcal FROM exercises WHERE date BETWEEN ? AND ? GROUP BY date")
    .all(from, to) as { date: string; kcal: number }[];
  const weights = db
    .prepare("SELECT date, kg FROM weights WHERE date BETWEEN ? AND ?")
    .all(from, to) as { date: string; kg: number }[];

  const days: TrendDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const t = sumNutrients(food.filter((f) => f.date === d).map((f) => JSON.parse(f.nutrients) as Nutrients));
    days.push({
      date: d,
      kcal: Math.round(t.kcal ?? 0),
      protein: Math.round(t.protein ?? 0),
      carbs: Math.round(t.carbs ?? 0),
      fat: Math.round(t.fat ?? 0),
      exerciseKcal: Math.round(ex.find((e) => e.date === d)?.kcal ?? 0),
      weightKg: weights.find((w) => w.date === d)?.kg ?? null,
    });
  }
  return days;
}

export function logWeight(db: DB, date: string, kg: number): void {
  db.prepare("INSERT INTO weights (date, kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg").run(
    date, kg);
}
