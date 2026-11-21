export const REGIONS = ["Chest", "Back", "Shoulders", "Arms", "Core", "Legs"] as const;
export type Region = (typeof REGIONS)[number];

export const MUSCLES = [
  { key: "chest", label: "Chest", region: "Chest" },
  { key: "lats", label: "Lats", region: "Back" },
  { key: "upper_back", label: "Upper back", region: "Back" },
  { key: "traps", label: "Traps", region: "Back" },
  { key: "lower_back", label: "Lower back", region: "Back" },
  { key: "shoulders", label: "Shoulders", region: "Shoulders" },
  { key: "rear_delts", label: "Rear delts", region: "Shoulders" },
  { key: "biceps", label: "Biceps", region: "Arms" },
  { key: "triceps", label: "Triceps", region: "Arms" },
  { key: "forearms", label: "Forearms", region: "Arms" },
  { key: "abs", label: "Abs", region: "Core" },
  { key: "quads", label: "Quads", region: "Legs" },
  { key: "hamstrings", label: "Hamstrings", region: "Legs" },
  { key: "glutes", label: "Glutes", region: "Legs" },
  { key: "calves", label: "Calves", region: "Legs" },
  { key: "adductors", label: "Adductors", region: "Legs" },
] as const;

export type Muscle = (typeof MUSCLES)[number]["key"];
/** What a movement mainly trains. Cardio has no muscle and never counts towards set volume. */
export type Target = Muscle | "cardio";

export const MUSCLE_LABEL = Object.fromEntries(MUSCLES.map((m) => [m.key, m.label])) as Record<Muscle, string>;
export const MUSCLE_REGION = Object.fromEntries(MUSCLES.map((m) => [m.key, m.region])) as Record<Muscle, Region>;

export const isMuscle = (v: string): v is Muscle => v in MUSCLE_LABEL;
