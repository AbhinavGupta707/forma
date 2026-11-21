import { beforeEach, describe, expect, it } from "vitest";
import { type DB, openDb } from "./db";
import { addEntries, addExercise, copyMeal, getDay, recentItems, trends, updateEntry } from "./log";
import { saveRecipe } from "./recipes";
import { savePrefs, saveProfile } from "./settings";
import { DEFAULT_PROFILE } from "./goals";

let db: DB;
const D = "2026-11-03";

beforeEach(() => {
  db = openDb(":memory:");
  const food = db.prepare("INSERT INTO foods (id, source, name, nutrients) VALUES (?, 'sr', ?, ?)");
  food.run(1, "Egg", JSON.stringify({ kcal: 140, protein: 12, fat: 10 }));
  food.run(2, "Oats", JSON.stringify({ kcal: 380, protein: 13, carbs: 68 }));
  saveProfile(db, { ...DEFAULT_PROFILE, kcalOverride: 2000 });
});

describe("log", () => {
  it("snapshots nutrients scaled to grams and totals the day", () => {
    addEntries(db, [
      { kind: "food", date: D, meal: "breakfast", foodId: 1, grams: 100 },
      { kind: "food", date: D, meal: "lunch", foodId: 2, grams: 50 },
    ]);
    const day = getDay(db, D);
    expect(day.meals.breakfast).toHaveLength(1);
    expect(day.totals.kcal).toBe(140 + 190);
    expect(day.remaining).toBe(2000 - 330);
  });

  it("logs recipes per serving", () => {
    const id = saveRecipe(db, { name: "Breakfast bowl", aliases: [], servings: 2,
      items: [{ foodId: 1, grams: 100 }, { foodId: 2, grams: 100 }] });
    addEntries(db, [{ kind: "recipe", date: D, meal: "breakfast", recipeId: id, servings: 1 }]);
    expect(getDay(db, D).totals.kcal).toBe((140 + 380) / 2);
  });

  it("adds exercise back to the budget only when enabled", () => {
    addExercise(db, { date: D, label: "Run", minutes: 30, kcal: 300 });
    expect(getDay(db, D).budget).toBe(2300);
    savePrefs(db, { units: "metric", addExerciseBack: false });
    expect(getDay(db, D).budget).toBe(2000);
  });

  it("recomputes nutrients when the amount changes", () => {
    const [id] = addEntries(db, [{ kind: "food", date: D, meal: "breakfast", foodId: 1, grams: 50 }]);
    updateEntry(db, id, { grams: 200, meal: "dinner" });
    const day = getDay(db, D);
    expect(day.meals.dinner[0].nutrients.kcal).toBe(280);
  });

  it("copies a meal to another day", () => {
    addEntries(db, [{ kind: "food", date: "2026-11-02", meal: "breakfast", foodId: 1, grams: 100 }]);
    expect(copyMeal(db, "2026-11-02", D, "breakfast")).toBe(1);
    expect(getDay(db, D).totals.kcal).toBe(140);
  });

  it("lists recent distinct items, newest first", () => {
    addEntries(db, [
      { kind: "food", date: D, meal: "breakfast", foodId: 1, grams: 100 },
      { kind: "food", date: D, meal: "lunch", foodId: 2, grams: 50 },
      { kind: "food", date: D, meal: "dinner", foodId: 1, grams: 60 },
    ]);
    const r = recentItems(db);
    expect(r.map((x) => x.id)).toEqual([1, 2]);
    expect(r[0].grams).toBe(60);
  });

  it("returns one trend row per day including empty days", () => {
    addEntries(db, [{ kind: "food", date: D, meal: "breakfast", foodId: 1, grams: 100 }]);
    const t = trends(db, "2026-11-01", D);
    expect(t.map((d) => d.kcal)).toEqual([0, 0, 140]);
  });
});
