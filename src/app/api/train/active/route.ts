import { getDb } from "@/lib/db";
import { handle, ok } from "@/lib/api";
import { activeWorkout } from "@/lib/train/workouts";

export const GET = handle(() => ok(activeWorkout(getDb())));
