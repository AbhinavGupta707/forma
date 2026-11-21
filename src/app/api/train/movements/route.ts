import { getDb } from "@/lib/db";
import { handle, ok, parseBody } from "@/lib/api";
import type { Equipment } from "@/lib/train/catalog";
import { createMovement, searchMovements } from "@/lib/train/movements";
import type { Target } from "@/lib/train/muscles";
import { movementSchema } from "@/lib/train/schemas";

export const GET = handle((req: Request) => {
  const p = new URL(req.url).searchParams;
  return ok(searchMovements(getDb(), {
    q: p.get("q") ?? undefined,
    muscle: (p.get("muscle") as Target | null) ?? undefined,
    equipment: (p.get("equipment") as Equipment | null) ?? undefined,
  }));
});

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, movementSchema);
  return ok(createMovement(getDb(), body as Parameters<typeof createMovement>[1]), 201);
});
