import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seedMovements } from "./train/movements";
import { seedStarterFoods } from "./starter-foods";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS foods (
  id INTEGER PRIMARY KEY,            -- USDA fdc_id for USDA foods
  source TEXT NOT NULL,              -- fndds | foundation | sr | starter | custom
  name TEXT NOT NULL,
  category TEXT,
  nutrients TEXT NOT NULL            -- JSON, per 100 g
);
CREATE VIRTUAL TABLE IF NOT EXISTS foods_fts USING fts5(
  name, content='foods', content_rowid='id', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS foods_ai AFTER INSERT ON foods BEGIN
  INSERT INTO foods_fts(rowid, name) VALUES (new.id, new.name);
END;
CREATE TRIGGER IF NOT EXISTS foods_ad AFTER DELETE ON foods BEGIN
  INSERT INTO foods_fts(foods_fts, rowid, name) VALUES ('delete', old.id, old.name);
END;
CREATE TRIGGER IF NOT EXISTS foods_au AFTER UPDATE ON foods BEGIN
  INSERT INTO foods_fts(foods_fts, rowid, name) VALUES ('delete', old.id, old.name);
  INSERT INTO foods_fts(rowid, name) VALUES (new.id, new.name);
END;
CREATE TABLE IF NOT EXISTS portions (
  id INTEGER PRIMARY KEY,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  grams REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS portions_food ON portions(food_id);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  aliases TEXT NOT NULL DEFAULT '[]', -- JSON string[]
  servings REAL NOT NULL DEFAULT 1,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS recipe_items (
  id INTEGER PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id),
  grams REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,                -- YYYY-MM-DD, local
  meal TEXT NOT NULL,                -- breakfast | lunch | dinner | snacks
  label TEXT NOT NULL,
  food_id INTEGER,
  recipe_id INTEGER,
  grams REAL,
  servings REAL,
  nutrients TEXT NOT NULL,           -- JSON snapshot for this entry
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS entries_date ON entries(date);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  minutes REAL,
  kcal REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS exercises_date ON exercises(date);

CREATE TABLE IF NOT EXISTS weights (
  date TEXT PRIMARY KEY,
  kg REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL                -- JSON
);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                -- load | bodyweight | assisted | hold | cardio
  equipment TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary TEXT NOT NULL DEFAULT '[]', -- JSON string[]
  aliases TEXT NOT NULL DEFAULT '',
  met REAL,
  custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS routine_items (
  id INTEGER PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  movement_id INTEGER NOT NULL REFERENCES movements(id),
  position INTEGER NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER,
  rest_sec INTEGER NOT NULL,
  superset_id INTEGER
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,                -- YYYY-MM-DD, local
  name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,              -- active | done
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  started_at TEXT,                   -- null when logged after the fact
  ended_at TEXT,
  duration_min REAL,
  rpe REAL,
  kcal REAL
);
CREATE INDEX IF NOT EXISTS workouts_date ON workouts(date);
CREATE TABLE IF NOT EXISTS workout_items (
  id INTEGER PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  movement_id INTEGER NOT NULL REFERENCES movements(id),
  position INTEGER NOT NULL,
  superset_id INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  rest_sec INTEGER NOT NULL,
  target_reps INTEGER
);
CREATE INDEX IF NOT EXISTS workout_items_workout ON workout_items(workout_id);
CREATE INDEX IF NOT EXISTS workout_items_movement ON workout_items(movement_id);
CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES workout_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,                -- normal | warmup | drop | failure
  weight_kg REAL,
  reps INTEGER,
  rpe REAL,
  duration_sec REAL,
  distance_km REAL,
  speed_kmh REAL,
  incline_pct REAL,
  kcal REAL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS workout_sets_item ON workout_sets(item_id);
`;

/** Links a calorie-burn row to the workout that created it, so editing a workout can update it. */
function migrate(db: DB): void {
  const cols = db.prepare("PRAGMA table_info(exercises)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "workout_id")) {
    db.exec("ALTER TABLE exercises ADD COLUMN workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE");
  }
}

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  seedMovements(db);
  return db;
}

const globalForDb = globalThis as unknown as { formaDb?: DB };

/** Shared app connection; cached on globalThis so dev hot-reload doesn't reopen it. */
export function getDb(): DB {
  if (!globalForDb.formaDb) {
    const db = openDb(process.env.FORMA_DB ?? path.join(process.cwd(), "data", "forma.db"));
    seedStarterFoods(db);
    globalForDb.formaDb = db;
  }
  return globalForDb.formaDb;
}
