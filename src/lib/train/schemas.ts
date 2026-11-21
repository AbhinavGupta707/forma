// Request validation for the training API.
import { z } from "zod";
import { dateSchema } from "../api";
import { MUSCLES } from "./muscles";

const muscle = z.enum(MUSCLES.map((m) => m.key) as [string, ...string[]]);
const num = (max: number) => z.number().nonnegative().max(max).nullable();

export const setSchema = z.object({
  kind: z.enum(["normal", "warmup", "drop", "failure"]),
  weightKg: num(1000),
  reps: z.number().int().nonnegative().max(1000).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  durationSec: num(86400),
  distanceKm: num(1000),
  speedKmh: num(50),
  inclinePct: num(40),
  kcal: num(10000),
  done: z.boolean(),
});

export const workoutSchema = z.object({
  name: z.string().trim().max(80),
  notes: z.string().max(2000),
  date: dateSchema,
  items: z.array(z.object({
    movementId: z.number().int().positive(),
    supersetId: z.number().int().positive().nullable(),
    notes: z.string().max(500),
    restSec: z.number().int().nonnegative().max(1800),
    targetReps: z.number().int().positive().max(1000).nullable(),
    sets: z.array(setSchema).max(100),
  })).max(60),
});

export const createWorkoutSchema = z.object({
  date: dateSchema,
  name: z.string().trim().max(80).optional(),
  routineId: z.number().int().positive().optional(),
  fromWorkoutId: z.number().int().positive().optional(),
  retro: z.boolean().optional(),
});

export const finishSchema = z.object({
  durationMin: z.number().positive().max(1440).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  notes: z.string().max(2000),
  kcal: z.number().nonnegative().max(10000).nullable(),
});

export const routineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(1000),
  items: z.array(z.object({
    movementId: z.number().int().positive(),
    sets: z.number().int().min(1).max(30),
    reps: z.number().int().positive().max(1000).nullable(),
    restSec: z.number().int().nonnegative().max(1800),
    supersetId: z.number().int().positive().nullable(),
  })).min(1).max(60),
});

export const movementSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["load", "bodyweight", "assisted", "hold", "cardio"]),
  equipment: z.enum(["barbell", "dumbbell", "machine", "cable", "smith", "kettlebell", "band", "bodyweight", "cardio", "other"]),
  primary: z.union([muscle, z.literal("cardio")]),
  secondary: z.array(muscle).max(6),
});

export const parseSchema = z.object({
  text: z.string().trim().min(2).max(2000),
  date: dateSchema,
  workoutId: z.number().int().positive().optional(),
});
