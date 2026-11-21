// Built-in exercise library, with muscles worked. Custom exercises live alongside these in the movements table.
import type { Muscle, Target } from "./muscles";

export type MovementKind = "load" | "bodyweight" | "assisted" | "hold" | "cardio";
export type Equipment =
  | "barbell" | "dumbbell" | "machine" | "cable" | "smith" | "kettlebell" | "band" | "bodyweight" | "cardio" | "other";

type Row = [name: string, equipment: Equipment, kind: MovementKind, primary: Target, secondary: Muscle[], aliases?: string];
type CardioRow = [name: string, met: number, aliases?: string];

const STRENGTH: Row[] = [
  // Chest
  ["Barbell Bench Press", "barbell", "load", "chest", ["triceps", "shoulders"], "flat bench bb"],
  ["Incline Barbell Bench Press", "barbell", "load", "chest", ["shoulders", "triceps"], "incline bench"],
  ["Decline Barbell Bench Press", "barbell", "load", "chest", ["triceps"], "decline bench"],
  ["Dumbbell Bench Press", "dumbbell", "load", "chest", ["triceps", "shoulders"], "db bench flat"],
  ["Incline Dumbbell Press", "dumbbell", "load", "chest", ["shoulders", "triceps"], "db incline bench"],
  ["Smith Machine Bench Press", "smith", "load", "chest", ["triceps", "shoulders"]],
  ["Machine Chest Press", "machine", "load", "chest", ["triceps", "shoulders"], "seated chest press"],
  ["Incline Machine Press", "machine", "load", "chest", ["shoulders", "triceps"]],
  ["Pec Deck", "machine", "load", "chest", [], "machine fly butterfly"],
  ["Dumbbell Fly", "dumbbell", "load", "chest", [], "db flye"],
  ["Cable Fly", "cable", "load", "chest", [], "cable crossover flye"],
  ["Low-to-High Cable Fly", "cable", "load", "chest", ["shoulders"], "upper chest"],
  ["Push-Up", "bodyweight", "bodyweight", "chest", ["triceps", "shoulders"], "press up pushup"],
  ["Chest Dip", "bodyweight", "bodyweight", "chest", ["triceps", "shoulders"], "dips"],
  ["Assisted Dip", "machine", "assisted", "chest", ["triceps", "shoulders"]],
  // Back
  ["Pull-Up", "bodyweight", "bodyweight", "lats", ["biceps", "upper_back"], "pullup"],
  ["Chin-Up", "bodyweight", "bodyweight", "lats", ["biceps"], "chinup"],
  ["Assisted Pull-Up", "machine", "assisted", "lats", ["biceps", "upper_back"], "assisted chin"],
  ["Lat Pulldown", "cable", "load", "lats", ["biceps", "upper_back"], "wide grip pull down"],
  ["Close-Grip Lat Pulldown", "cable", "load", "lats", ["biceps"], "v bar pull down"],
  ["Single-Arm Lat Pulldown", "cable", "load", "lats", ["biceps"]],
  ["Straight-Arm Pulldown", "cable", "load", "lats", [], "pullover"],
  ["Barbell Row", "barbell", "load", "upper_back", ["lats", "biceps", "rear_delts"], "bent over row bb"],
  ["Pendlay Row", "barbell", "load", "upper_back", ["lats", "biceps"]],
  ["T-Bar Row", "barbell", "load", "upper_back", ["lats", "biceps"]],
  ["Dumbbell Row", "dumbbell", "load", "lats", ["upper_back", "biceps"], "one arm db row"],
  ["Chest-Supported Row", "dumbbell", "load", "upper_back", ["lats", "biceps", "rear_delts"], "incline db row"],
  ["Seated Cable Row", "cable", "load", "upper_back", ["lats", "biceps"], "low row"],
  ["Machine Row", "machine", "load", "upper_back", ["lats", "biceps"], "seated row"],
  ["Inverted Row", "bodyweight", "bodyweight", "upper_back", ["biceps", "lats"], "australian pull up"],
  ["Barbell Shrug", "barbell", "load", "traps", ["forearms"], "shrugs"],
  ["Dumbbell Shrug", "dumbbell", "load", "traps", ["forearms"], "db shrugs"],
  ["Back Extension", "bodyweight", "bodyweight", "lower_back", ["glutes", "hamstrings"], "hyperextension"],
  // Shoulders
  ["Overhead Press", "barbell", "load", "shoulders", ["triceps", "upper_back"], "ohp military press standing"],
  ["Seated Dumbbell Press", "dumbbell", "load", "shoulders", ["triceps"], "db shoulder press"],
  ["Arnold Press", "dumbbell", "load", "shoulders", ["triceps"]],
  ["Machine Shoulder Press", "machine", "load", "shoulders", ["triceps"]],
  ["Smith Machine Shoulder Press", "smith", "load", "shoulders", ["triceps"]],
  ["Dumbbell Lateral Raise", "dumbbell", "load", "shoulders", [], "side raise lat raises"],
  ["Cable Lateral Raise", "cable", "load", "shoulders", [], "side raise"],
  ["Machine Lateral Raise", "machine", "load", "shoulders", []],
  ["Front Raise", "dumbbell", "load", "shoulders", []],
  ["Upright Row", "barbell", "load", "shoulders", ["traps", "biceps"]],
  ["Reverse Pec Deck", "machine", "load", "rear_delts", ["upper_back"], "rear delt fly machine"],
  ["Bent-Over Dumbbell Reverse Fly", "dumbbell", "load", "rear_delts", ["upper_back"], "rear delt raise"],
  ["Face Pull", "cable", "load", "rear_delts", ["upper_back", "traps"]],
  // Arms
  ["Barbell Curl", "barbell", "load", "biceps", ["forearms"], "bb curl"],
  ["EZ-Bar Curl", "barbell", "load", "biceps", ["forearms"], "ez curl"],
  ["Dumbbell Curl", "dumbbell", "load", "biceps", ["forearms"], "db curl bicep"],
  ["Incline Dumbbell Curl", "dumbbell", "load", "biceps", []],
  ["Hammer Curl", "dumbbell", "load", "biceps", ["forearms"]],
  ["Preacher Curl", "machine", "load", "biceps", [], "scott curl"],
  ["Cable Curl", "cable", "load", "biceps", ["forearms"]],
  ["Concentration Curl", "dumbbell", "load", "biceps", []],
  ["Triceps Pushdown", "cable", "load", "triceps", [], "tricep pressdown rope bar"],
  ["Overhead Cable Extension", "cable", "load", "triceps", [], "overhead tricep rope"],
  ["Overhead Dumbbell Extension", "dumbbell", "load", "triceps", [], "tricep french press"],
  ["Skull Crusher", "barbell", "load", "triceps", [], "lying triceps extension ez"],
  ["Close-Grip Bench Press", "barbell", "load", "triceps", ["chest", "shoulders"]],
  ["Triceps Dip", "bodyweight", "bodyweight", "triceps", ["chest", "shoulders"], "bench dips"],
  ["Machine Triceps Extension", "machine", "load", "triceps", []],
  ["Wrist Curl", "dumbbell", "load", "forearms", []],
  ["Reverse Curl", "barbell", "load", "forearms", ["biceps"]],
  ["Farmer's Carry", "dumbbell", "load", "forearms", ["traps", "abs"], "farmers walk"],
  // Core
  ["Plank", "bodyweight", "hold", "abs", [], "front hold"],
  ["Side Plank", "bodyweight", "hold", "abs", []],
  ["Crunch", "bodyweight", "bodyweight", "abs", [], "sit up"],
  ["Cable Crunch", "cable", "load", "abs", [], "kneeling crunch"],
  ["Machine Crunch", "machine", "load", "abs", []],
  ["Hanging Leg Raise", "bodyweight", "bodyweight", "abs", [], "knee raise"],
  ["Lying Leg Raise", "bodyweight", "bodyweight", "abs", []],
  ["Ab Wheel Rollout", "other", "bodyweight", "abs", ["lats"]],
  ["Russian Twist", "bodyweight", "bodyweight", "abs", []],
  ["Pallof Press", "cable", "load", "abs", []],
  ["Dead Bug", "bodyweight", "bodyweight", "abs", []],
  // Legs
  ["Barbell Back Squat", "barbell", "load", "quads", ["glutes", "adductors", "lower_back"], "squat high bar low bar"],
  ["Front Squat", "barbell", "load", "quads", ["glutes", "abs"]],
  ["Goblet Squat", "dumbbell", "load", "quads", ["glutes"]],
  ["Hack Squat", "machine", "load", "quads", ["glutes"]],
  ["Smith Machine Squat", "smith", "load", "quads", ["glutes"]],
  ["Pendulum Squat", "machine", "load", "quads", ["glutes"]],
  ["Leg Press", "machine", "load", "quads", ["glutes", "adductors"]],
  ["Leg Extension", "machine", "load", "quads", [], "quad extension"],
  ["Bulgarian Split Squat", "dumbbell", "load", "quads", ["glutes", "adductors"], "rear foot elevated"],
  ["Walking Lunge", "dumbbell", "load", "quads", ["glutes", "hamstrings"], "lunges"],
  ["Reverse Lunge", "dumbbell", "load", "quads", ["glutes"]],
  ["Step-Up", "dumbbell", "load", "quads", ["glutes"]],
  ["Bodyweight Squat", "bodyweight", "bodyweight", "quads", ["glutes"], "air squat"],
  ["Deadlift", "barbell", "load", "hamstrings", ["glutes", "lower_back", "traps", "forearms"], "conventional"],
  ["Sumo Deadlift", "barbell", "load", "glutes", ["hamstrings", "adductors", "lower_back"]],
  ["Trap Bar Deadlift", "barbell", "load", "quads", ["glutes", "hamstrings", "lower_back"], "hex bar"],
  ["Romanian Deadlift", "barbell", "load", "hamstrings", ["glutes", "lower_back"], "rdl"],
  ["Dumbbell Romanian Deadlift", "dumbbell", "load", "hamstrings", ["glutes", "lower_back"], "db rdl"],
  ["Stiff-Leg Deadlift", "barbell", "load", "hamstrings", ["glutes", "lower_back"]],
  ["Good Morning", "barbell", "load", "hamstrings", ["lower_back", "glutes"]],
  ["Lying Leg Curl", "machine", "load", "hamstrings", ["calves"], "hamstring curl"],
  ["Seated Leg Curl", "machine", "load", "hamstrings", [], "hamstring curl"],
  ["Nordic Curl", "bodyweight", "bodyweight", "hamstrings", []],
  ["Hip Thrust", "barbell", "load", "glutes", ["hamstrings"], "barbell glute bridge"],
  ["Machine Hip Thrust", "machine", "load", "glutes", ["hamstrings"]],
  ["Glute Bridge", "bodyweight", "bodyweight", "glutes", ["hamstrings"]],
  ["Cable Kickback", "cable", "load", "glutes", ["hamstrings"], "glute kickback"],
  ["Hip Abduction Machine", "machine", "load", "glutes", [], "abductor outer thigh"],
  ["Hip Adduction Machine", "machine", "load", "adductors", [], "adductor inner thigh"],
  ["Standing Calf Raise", "machine", "load", "calves", []],
  ["Seated Calf Raise", "machine", "load", "calves", []],
  ["Leg Press Calf Raise", "machine", "load", "calves", []],
  // Full body
  ["Kettlebell Swing", "kettlebell", "load", "glutes", ["hamstrings", "lower_back"]],
  ["Clean and Press", "barbell", "load", "shoulders", ["quads", "glutes", "traps"]],
  ["Power Clean", "barbell", "load", "hamstrings", ["glutes", "traps", "quads"]],
  ["Thruster", "barbell", "load", "quads", ["shoulders", "glutes", "triceps"]],
];

// MET values from the 2024 Adult Compendium of Physical Activities.
const CARDIO: CardioRow[] = [
  ["Treadmill", 7, "run walk incline"],
  ["Outdoor Run", 9.8, "running jog"],
  ["Outdoor Walk", 3.5, "walking"],
  ["Hiking", 6],
  ["Cycling", 7.5, "bike ride"],
  ["Stationary Bike", 6.8, "exercise bike spin"],
  ["Rowing Machine", 7, "erg rower"],
  ["Elliptical", 5, "cross trainer"],
  ["Stair Climber", 9, "stairmaster stepper"],
  ["Swimming", 7, "laps"],
  ["Jump Rope", 11, "skipping"],
  ["HIIT", 8, "circuit intervals"],
  ["Boxing", 7.8, "bag work"],
  ["Football", 7, "soccer"],
  ["Badminton", 5.5],
  ["Tennis", 7.3],
  ["Basketball", 6.5],
  ["Cricket", 4.8],
  ["Yoga", 2.5],
  ["Pilates", 3],
];

export const slug = (name: string): string => name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface CatalogMovement {
  key: string;
  name: string;
  kind: MovementKind;
  equipment: Equipment;
  primary: Target;
  secondary: Muscle[];
  aliases: string;
  met: number | null;
}

export const CATALOG: CatalogMovement[] = [
  ...STRENGTH.map(([name, equipment, kind, primary, secondary, aliases]) => ({
    key: slug(name), name, kind, equipment, primary, secondary, aliases: aliases ?? "", met: null,
  })),
  ...CARDIO.map(([name, met, aliases]) => ({
    key: slug(name), name, kind: "cardio" as const, equipment: "cardio" as const, primary: "cardio" as const,
    secondary: [], aliases: aliases ?? "", met,
  })),
];
