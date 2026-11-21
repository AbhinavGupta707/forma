import { beforeEach, describe, expect, it } from "vitest";
import { type DB, openDb } from "./db";
import { createCustomFood, searchCustomFoods } from "./foods";

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
  db.prepare("INSERT INTO foods (id, source, name, nutrients) VALUES (1, 'sr', 'Yogurt, Greek, plain', '{\"kcal\":59}')").run();
  createCustomFood(db, {
    name: "Greek yogurt 0% fat (my yoghurt)",
    nutrients: { kcal: 53 },
    servingGrams: 100,
    servingLabel: "serving",
  });
});

describe("searchCustomFoods", () => {
  it("finds my food when only some query words match", () => {
    expect(searchCustomFoods(db, "yogurt greek nonfat plain").map((f) => f.name)).toEqual([
      "Greek yogurt 0% fat (my yoghurt)",
    ]);
  });

  it("matches the British spelling", () => {
    expect(searchCustomFoods(db, "my yoghurt")).toHaveLength(1);
  });

  it("ignores USDA foods and unrelated queries", () => {
    expect(searchCustomFoods(db, "egg fried")).toEqual([]);
    expect(searchCustomFoods(db, "")).toEqual([]);
  });
});
