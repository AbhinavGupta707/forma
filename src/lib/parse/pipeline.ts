// Voice/text → proposed log entries. Two LLM calls: extract items, then pick USDA matches.
import { z } from "zod";
import type { DB } from "../db";
import { ACTIVITIES, exerciseKcal, findActivity } from "../exercise";
import { type FoodSummary, getFood, searchCustomFoods, searchFoods } from "../foods";
import { type Nutrients, scaleNutrients } from "../nutrients";
import { findRecipeByName, listRecipes } from "../recipes";
import { gramsFor } from "../units";
import { addDays, type Meal, MEALS } from "../dates";
import { completeJson, type LlmOptions, type LlmUsage } from "./llm";

const extractSchema = z.object({
  day_offset: z.number().int().min(-7).max(0),
  foods: z.array(
    z.object({
      description: z.string(),
      recipe: z.string(),
      query: z.string(),
      quantity: z.number().nonnegative(),
      unit: z.string(),
      estimated_grams: z.number().nonnegative(),
      meal: z.enum(MEALS),
    }),
  ),
  exercises: z.array(
    z.object({
      description: z.string(),
      activity: z.string(),
      minutes: z.number().nonnegative(),
      stated_kcal: z.number().nonnegative(),
    }),
  ),
});
type Extracted = z.infer<typeof extractSchema>;

const extractJsonSchema = z.toJSONSchema(extractSchema) as Record<string, unknown>;

const matchSchema = z.object({
  choices: z.array(z.object({ index: z.number().int(), food_id: z.number().int() })),
});
const matchJsonSchema = z.toJSONSchema(matchSchema) as Record<string, unknown>;

export interface ProposedFood {
  description: string;
  meal: Meal;
  label: string;
  foodId: number | null;
  recipeId: number | null;
  quantity: number;
  unit: string;
  grams: number | null;
  servings: number | null;
  basis: string;
  nutrients: Nutrients;
  alternatives: FoodSummary[];
}

export interface ProposedExercise {
  description: string;
  activity: string;
  label: string;
  minutes: number;
  kcal: number;
}

export interface Proposal {
  date: string;
  foods: ProposedFood[];
  exercises: ProposedExercise[];
  usage: LlmUsage[];
}

export interface ParseContext {
  date: string;
  /** Local time "HH:MM" used to infer the meal. */
  time: string;
  weightKg: number;
}

function extractPrompt(db: DB, ctx: ParseContext): string {
  const recipes = listRecipes(db)
    .map((r) => `- ${r.name}${r.aliases.length ? ` (also: ${r.aliases.join(", ")})` : ""}`)
    .join("\n");
  return `You turn a person's spoken food and exercise log into structured data.
Today is ${ctx.date}, local time ${ctx.time}.

Foods:
- One item per distinct food. A dish named as one thing ("chicken burrito", "caesar salad") stays one item; "eggs and toast" is two.
- If an item refers to one of the person's saved recipes below, set "recipe" to that recipe's exact name and put the number of servings in "quantity" (unit "serving"). Otherwise "recipe" is "".
- "query": 2-4 search words for a USDA food database, naming the food in its eaten form, most important word first (e.g. "egg fried", "rice white cooked", "milk whole", "bread whole wheat toasted"). The database uses US food names, so translate regional terms (UK/Indian "biscuit" → "cookie", "crisps" → "potato chips", "curd" → "yogurt").
- "quantity" and "unit" as spoken. Use unit "" for bare counts ("two eggs"). Normalise units to: g, kg, oz, lb, ml, l, cup, tbsp, tsp, slice, piece, small, medium, large, serving, or the spoken container word.
- "estimated_grams": your best estimate of the total grams eaten for that item.
- "meal": breakfast, lunch, dinner or snacks. Use what the person says; if unstated, infer from the local time (before 10:30 breakfast, 10:30-15:00 lunch, 15:00-17:30 snacks, after 17:30 dinner).
- "day_offset": 0 for today, -1 for yesterday, and so on.

Exercises:
- "activity" must be one of: ${ACTIVITIES.map((a) => a.key).join(", ")}. Pick the closest.
- "minutes": duration. "stated_kcal": calories burned only if the person says a number, else 0.

Saved recipes:
${recipes || "(none)"}

Return empty arrays when there is nothing of that kind.`;
}

async function pickMatches(
  items: { index: number; description: string; candidates: FoodSummary[] }[],
  opts: LlmOptions,
): Promise<{ picks: Map<number, number>; usage: LlmUsage | null }> {
  if (items.length === 0) return { picks: new Map(), usage: null };
  const listing = items
    .map(
      (it) =>
        `Item ${it.index}: "${it.description}"\n` +
        it.candidates
          .map((c) => `  ${c.id} | ${c.name} | ${Math.round(c.kcalPer100g)} kcal/100g${c.source === "custom" ? " | MY FOOD" : ""}`)
          .join("\n"),
    )
    .join("\n\n");
  const { data, usage } = await completeJson(
    [
      {
        role: "system",
        content:
          "For each item, choose the database food that best matches what the person ate. " +
          "Match the preparation when stated (fried, grilled, cooked vs raw). For plain mentions pick the most " +
          "ordinary version (e.g. whole, cooked, no added fat). Candidates marked MY FOOD are what this person keeps at " +
          "home: choose one whenever it is the same kind of food, unless they say it came from elsewhere. " +
          "Return food_id 0 only when no candidate is the same food.",
      },
      { role: "user", content: listing },
    ],
    matchSchema,
    matchJsonSchema,
    opts,
  );
  return { picks: new Map(data.choices.map((c) => [c.index, c.food_id])), usage };
}

function candidatesFor(db: DB, query: string, description: string): FoodSummary[] {
  const seen = new Set<number>();
  const mine = searchCustomFoods(db, `${query} ${description}`);
  return [...mine, ...searchFoods(db, query, 8), ...searchFoods(db, description, 4)].filter(
    (f) => !seen.has(f.id) && seen.add(f.id),
  );
}

export async function parseLog(
  db: DB,
  transcript: string,
  ctx: ParseContext,
  opts: LlmOptions = {},
): Promise<Proposal> {
  const { data: ex, usage: u1 } = await completeJson<Extracted>(
    [
      { role: "system", content: extractPrompt(db, ctx) },
      { role: "user", content: transcript },
    ],
    extractSchema,
    extractJsonSchema,
    opts,
  );

  // Vague amounts ("some broccoli") can come back as 0; treat them as one portion.
  const pending = ex.foods.map((raw, index) => {
    const f = { ...raw, quantity: raw.quantity || 1 };
    const recipe = f.recipe ? findRecipeByName(db, f.recipe) : null;
    return { f, index, recipe, candidates: recipe ? [] : candidatesFor(db, f.query, f.description) };
  });
  const { picks, usage: u2 } = await pickMatches(
    pending
      .filter((p) => !p.recipe && p.candidates.length > 0)
      .map((p) => ({ index: p.index, description: p.f.description, candidates: p.candidates })),
    opts,
  );

  const foods = pending.map(({ f, index, recipe, candidates }): ProposedFood => {
    const base = { description: f.description, meal: f.meal, quantity: f.quantity, unit: f.unit };
    if (recipe) {
      const servings = f.quantity;
      return {
        ...base,
        label: recipe.name,
        foodId: null,
        recipeId: recipe.id,
        grams: null,
        servings,
        basis: "recipe",
        nutrients: scaleNutrients(recipe.perServing, servings * 100),
        alternatives: [],
      };
    }
    const pickedId = picks.get(index);
    const food = pickedId ? getFood(db, pickedId) : null;
    if (!food) {
      return { ...base, label: f.description, foodId: null, recipeId: null, grams: f.estimated_grams,
        servings: null, basis: "unmatched", nutrients: {}, alternatives: candidates };
    }
    const { grams, basis } = gramsFor(f.quantity, f.unit, food.portions, f.estimated_grams);
    return {
      ...base,
      label: food.name,
      foodId: food.id,
      recipeId: null,
      grams,
      servings: null,
      basis,
      nutrients: scaleNutrients(food.nutrients, grams),
      alternatives: candidates.filter((c) => c.id !== food.id),
    };
  });

  const exercises = ex.exercises.map((e): ProposedExercise => {
    const activity = findActivity(e.activity);
    return {
      description: e.description,
      activity: e.activity,
      label: activity?.label ?? e.description,
      minutes: e.minutes,
      kcal: e.stated_kcal > 0 ? Math.round(e.stated_kcal) : exerciseKcal(e.activity, e.minutes, ctx.weightKg),
    };
  });

  return {
    date: addDays(ctx.date, ex.day_offset),
    foods,
    exercises,
    usage: [u1, ...(u2 ? [u2] : [])],
  };
}
