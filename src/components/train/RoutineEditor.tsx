"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Movement } from "@/lib/train/movements";
import type { Routine } from "@/lib/train/routines";
import { DEFAULT_REST_SEC } from "@/lib/train/session-ops";
import { api, errorMessage } from "@/components/client";
import { Button, ErrorNote } from "@/components/ui";
import { ExercisePicker } from "./ExercisePicker";
import { BackLink, Panel } from "./kit";
import { NumField } from "./NumField";

interface Row {
  movement: Movement;
  sets: number;
  reps: number | null;
  restSec: number;
  supersetId: number | null;
}

const NEW_SETS = 3;
const NEW_REPS = 10;

export function RoutineEditor({ routine }: { routine: Routine | null }) {
  const router = useRouter();
  const [name, setName] = useState(routine?.name ?? "");
  const [rows, setRows] = useState<Row[]>(routine?.items ?? []);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const add = (ms: Movement[]) => setRows((r) => [...r, ...ms.map((movement) => ({
    movement, sets: movement.kind === "cardio" ? 1 : NEW_SETS, reps: movement.kind === "cardio" ? null : NEW_REPS,
    restSec: movement.kind === "cardio" ? 0 : DEFAULT_REST_SEC, supersetId: null,
  }))]);

  async function save() {
    const body = { name, notes: routine?.notes ?? "", items: rows.map(({ movement, ...r }) => ({ ...r, movementId: movement.id })) };
    try {
      if (routine) await api.put(`/api/train/routines/${routine.id}`, body);
      else await api.post("/api/train/routines", body);
      router.push("/train");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove() {
    if (!routine) return;
    try {
      await api.del(`/api/train/routines/${routine.id}`);
      router.push("/train");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <BackLink href="/train" label="Train" />
      <h1 className="display text-5xl">{routine ? "Edit routine" : "New routine"}</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Routine name, e.g. Push A" aria-label="Routine name" className="w-full" />
      <Panel>
        {rows.length === 0 ? <p className="text-sm text-muted">Add the exercises you do in this session.</p> : (
          <ul className="-my-1 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={`${r.movement.id}-${i}`} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.movement.name}</span>
                {r.movement.kind !== "cardio" && (
                  <>
                    <span className="w-12"><NumField label={`${r.movement.name} sets`} integer value={r.sets} onChange={(v) => patch(i, { sets: v || 1 })} /></span>
                    <span className="text-xs text-muted">×</span>
                    <span className="w-12"><NumField label={`${r.movement.name} reps`} integer value={r.reps} onChange={(v) => patch(i, { reps: v })} /></span>
                  </>
                )}
                <button onClick={() => setRows((x) => x.filter((_, n) => n !== i))} aria-label={`Remove ${r.movement.name}`} className="h-9 w-7 text-muted">×</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Button variant="ghost" className="w-full" onClick={() => setPicking(true)}>+ Add exercises</Button>
      <ErrorNote message={error} />
      <Button className="w-full !py-3" onClick={save} disabled={!name.trim() || rows.length === 0}>Save routine</Button>
      {routine && <Button variant="danger" className="w-full" onClick={remove}>Delete routine</Button>}
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onAdd={add} />
    </div>
  );
}
