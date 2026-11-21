import { getDb } from "@/lib/db";
import { handle, ok, parseBody, queryDate } from "@/lib/api";
import { createWorkoutSchema } from "@/lib/train/schemas";
import { createWorkout, listWorkouts } from "@/lib/train/workouts";

export const GET = handle((req: Request) => ok(listWorkouts(getDb(), queryDate(req, "from"), queryDate(req, "to"))));

export const POST = handle(async (req: Request) => ok(createWorkout(getDb(), await parseBody(req, createWorkoutSchema)), 201));
