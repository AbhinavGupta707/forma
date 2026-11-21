import type { DB } from "../db";
import { CATALOG, type Equipment, type MovementKind, slug } from "./catalog";
import type { Muscle, Target } from "./muscles";

export interface Movement {
  id: number;
  key: string;
  name: string;
  kind: MovementKind;
  equipment: Equipment;
  primary: Target;
  secondary: Muscle[];
  met: number | null;
  custom: boolean;
}

interface MovementRow {
  id: number;
  key: string;
  name: string;
  kind: MovementKind;
  equipment: Equipment;
  primary_muscle: Target;
  secondary: string;
  met: number | null;
  custom: number;
}

export const toMovement = (r: MovementRow): Movement => ({
  id: r.id, key: r.key, name: r.name, kind: r.kind, equipment: r.equipment, primary: r.primary_muscle,
  secondary: JSON.parse(r.secondary) as Muscle[], met: r.met, custom: r.custom === 1,
});

/** Adds any built-in movements missing from the database. Safe to run on every start. */
export function seedMovements(db: DB): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO movements (key, name, kind, equipment, primary_muscle, secondary, aliases, met)
     VALUES (@key, @name, @kind, @equipment, @primary, @secondary, @aliases, @met)`,
  );
  db.transaction(() => {
    for (const m of CATALOG) insert.run({ ...m, secondary: JSON.stringify(m.secondary) });
  })();
}

export function getMovement(db: DB, id: number): Movement | null {
  const r = db.prepare("SELECT * FROM movements WHERE id = ?").get(id) as MovementRow | undefined;
  return r ? toMovement(r) : null;
}

export function movementByKey(db: DB, key: string): Movement | null {
  const r = db.prepare("SELECT * FROM movements WHERE key = ?").get(key) as MovementRow | undefined;
  return r ? toMovement(r) : null;
}

export interface MovementQuery {
  q?: string;
  muscle?: Target;
  equipment?: Equipment;
  limit?: number;
}

export interface MovementHit extends Movement {
  /** Sessions this movement appears in, most used first when browsing. */
  uses: number;
}

const DEFAULT_LIMIT = 200;

export function searchMovements(db: DB, query: MovementQuery): MovementHit[] {
  const words = (query.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const where = words.map(() => "(lower(m.name) LIKE ? OR lower(m.aliases) LIKE ?)");
  const args: (string | number)[] = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
  if (query.muscle) {
    where.push("(m.primary_muscle = ? OR m.secondary LIKE ?)");
    args.push(query.muscle, `%"${query.muscle}"%`);
  }
  if (query.equipment) {
    where.push("m.equipment = ?");
    args.push(query.equipment);
  }
  const rows = db
    .prepare(
      `SELECT m.*, count(DISTINCT i.workout_id) AS uses
         FROM movements m LEFT JOIN workout_items i ON i.movement_id = m.id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        GROUP BY m.id ORDER BY uses DESC, m.name LIMIT ?`,
    )
    .all(...args, query.limit ?? DEFAULT_LIMIT) as (MovementRow & { uses: number })[];
  return rows.map((r) => ({ ...toMovement(r), uses: r.uses }));
}

export interface CustomMovementInput {
  name: string;
  kind: MovementKind;
  equipment: Equipment;
  primary: Target;
  secondary: Muscle[];
}

export function createMovement(db: DB, input: CustomMovementInput): Movement {
  const key = `custom-${slug(input.name)}`;
  const existing = movementByKey(db, key);
  if (existing) return existing;
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO movements (key, name, kind, equipment, primary_muscle, secondary, aliases, met, custom)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, 1)`,
    )
    .run(key, input.name, input.kind, input.equipment, input.primary, JSON.stringify(input.secondary),
      input.kind === "cardio" ? 6 : null);
  return getMovement(db, Number(lastInsertRowid))!;
}
