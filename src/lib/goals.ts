export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface Profile {
  name?: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  /** Negative to lose, positive to gain, 0 to maintain. */
  weeklyChangeKg: number;
  proteinPerKg: number;
  /** Share of calories from fat, 0–100. */
  fatPct: number;
  /** Fixed calorie goal; replaces the computed one when set. */
  kcalOverride?: number;
}

export interface Targets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG = 7700;

export const DEFAULT_PROFILE: Profile = {
  sex: "male",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activity: "light",
  weeklyChangeKg: 0,
  proteinPerKg: 1.8,
  fatPct: 30,
};

/** Basal metabolic rate, Mifflin-St Jeor. */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

export function computeTargets(p: Profile): Targets {
  const b = bmr(p);
  const tdee = Math.round(b * ACTIVITY_MULTIPLIER[p.activity]);
  const kcal = p.kcalOverride ?? Math.round(tdee + (p.weeklyChangeKg * KCAL_PER_KG) / 7);
  const protein = Math.round(p.proteinPerKg * p.weightKg);
  const fat = Math.round((kcal * p.fatPct) / 100 / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(b), tdee, kcal, protein, carbs, fat };
}
