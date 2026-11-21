import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { addDays, localDate } from "../src/lib/dates";
import { openDb } from "../src/lib/db";
import { addEntries, logWeight } from "../src/lib/log";
import { saveRecipe } from "../src/lib/recipes";
import { seedStarterFoods, STARTER_FOOD_IDS as food } from "../src/lib/starter-foods";
import { emptySet } from "../src/lib/train/metrics";
import { movementByKey } from "../src/lib/train/movements";
import { createWorkout, finishWorkout, saveWorkout } from "../src/lib/train/workouts";

const demoDb = resolve("data", "demo.db");
const db = openDb(demoDb);
const today = localDate();
const seeded = db.transaction(() => {
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'demo_seeded'").get()) return false;

  seedStarterFoods(db);
  const oats = saveRecipe(db, {
    name: "Blueberry overnight oats", aliases: ["overnight oats"], servings: 1,
    items: [
      { foodId: food.oats, grams: 55 },
      { foodId: food.yogurt, grams: 160 },
      { foodId: food.blueberries, grams: 80 },
    ],
  });
  const bowl = saveRecipe(db, {
    name: "Chickpea and brown rice bowl", aliases: ["chickpea bowl"], servings: 2,
    items: [
      { foodId: food.chickpeas, grams: 250 },
      { foodId: food.rice, grams: 300 },
      { foodId: food.broccoli, grams: 180 },
      { foodId: food.oliveOil, grams: 20 },
    ],
  });

  for (let offset = 6; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    addEntries(db, [
      { kind: "recipe", date, meal: "breakfast", recipeId: oats, servings: 1 },
      { kind: "recipe", date, meal: "lunch", recipeId: bowl, servings: offset % 2 ? 1.5 : 1 },
      { kind: "food", date, meal: "snacks", foodId: offset % 2 ? food.apple : food.banana, grams: 135 },
    ]);
    if (offset > 0) {
      addEntries(db, [
        { kind: "food", date, meal: "dinner", foodId: offset % 2 ? food.salmon : food.tofu, grams: 160 },
        { kind: "food", date, meal: "dinner", foodId: food.rice, grams: 180 },
        { kind: "food", date, meal: "dinner", foodId: food.broccoli, grams: 100 },
      ]);
    }
  }
  for (const [offset, kg] of [[6, 71.8], [3, 71.6], [0, 71.7]]) {
    logWeight(db, addDays(today, -offset), kg);
  }

  const squat = movementByKey(db, "goblet-squat");
  const row = movementByKey(db, "dumbbell-row");
  const bike = movementByKey(db, "stationary-bike");
  if (!squat || !row || !bike) throw new Error("Sample exercises are missing from the catalogue.");

  for (const [offset, load] of [[5, 14], [2, 16], [0, 18]]) {
    const date = addDays(today, -offset);
    const name = "Full body and bike";
    const { id } = createWorkout(db, { date, retro: true });
    saveWorkout(db, id, {
      date, name, notes: "Sample workout",
      items: [
        ...[squat, row].map((movement) => ({
          movementId: movement.id, supersetId: null, notes: "", restSec: 90, targetReps: 10,
          sets: [10, 10, 9].map((reps) => ({ ...emptySet(), weightKg: load, reps, done: true })),
        })),
        {
          movementId: bike.id, supersetId: null, notes: "", restSec: 0, targetReps: null,
          sets: [{ ...emptySet(), durationSec: 900, done: true }],
        },
      ],
    });
    finishWorkout(db, id, { durationMin: 45, rpe: 6, notes: "Sample workout", kcal: null });
  }

  db.exec("INSERT INTO settings (key, value) VALUES ('demo_seeded', 'true')");
  return true;
}).immediate();
db.close();

console.log(seeded ? "Created the Forma sample database." : "Using the existing Forma sample database.");
const server = spawn(process.execPath, [
  require.resolve("next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", "3001", ...process.argv.slice(2),
], { env: { ...process.env, FORMA_DB: demoDb, FORMA_FIREWORKS_API_KEY: "" }, stdio: "inherit" });
server.on("exit", (code) => { process.exitCode = code ?? 0; });
