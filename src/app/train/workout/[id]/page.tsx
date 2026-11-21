"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Muscle, MUSCLE_LABEL } from "@/lib/train/muscles";
import type { DayWorkout } from "@/lib/train/views";
import { api, errorMessage } from "@/components/client";
import { Button, ErrorNote, Sheet } from "@/components/ui";
import { dateLong, fmtMinutes, fmtVolume, useToday } from "@/components/train/format";
import { BackLink, Loading, Panel, Stat } from "@/components/train/kit";
import { MuscleMap } from "@/components/train/MuscleMap";
import { SetList } from "@/components/train/SetList";

const FULL_SESSION_SETS = 10;

export default function WorkoutPage() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const today = useToday();
  const [w, setW] = useState<DayWorkout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get<DayWorkout>(`/api/train/workouts/${id}/summary`).then(setW).catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (!w) return error ? <ErrorNote message={error} /> : <Loading />;
  const map = Object.fromEntries(Object.entries(w.muscles).map(([m, v]) => [m, Math.min(1, v / FULL_SESSION_SETS)]));
  const headline = w.records.filter((r) => r.type === "weight" || r.type === "e1rm" || r.type === "reps" || r.type === "distance");

  const run = (fn: () => Promise<unknown>) => () => fn().catch((e) => setError(errorMessage(e)));
  const repeat = run(async () => {
    const r = await api.post<{ id: number }>("/api/train/workouts", { date: today, fromWorkoutId: id });
    router.push(`/train/session/${r.id}`);
  });
  const saveRoutine = run(async () => {
    await api.post(`/api/train/workouts/${id}/routine`, { name: routineName });
    setRoutineName(null);
    setSaved(true);
  });
  const remove = run(async () => {
    await api.del(`/api/train/workouts/${id}`);
    router.replace("/train");
  });

  return (
    <div className="rise space-y-4">
      <BackLink href="/train" label="Train" />
      <header>
        <p className="eyebrow">{dateLong(w.date)}</p>
        <h1 className="display mt-1 text-5xl">{w.name}</h1>
      </header>
      <ErrorNote message={error} />

      {headline.length > 0 && (
        <section className="knurl rounded-xl bg-accent p-4 text-on-accent">
          <p className="display text-3xl">{headline.length} new record{headline.length === 1 ? "" : "s"}</p>
          <ul className="mt-2 space-y-0.5 text-sm">
            {headline.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="truncate">{r.movementName}</span><span className="tabular shrink-0 font-semibold">{r.label}</span></li>)}
          </ul>
        </section>
      )}

      <Panel>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat label="Time" value={fmtMinutes(w.durationMin)} />
          <Stat label="Burned" value={`${Math.round(w.kcal ?? 0)} kcal`} />
          {w.stats.sets > 0 && <Stat label="Volume" value={fmtVolume(w.stats.volume)} />}
          {w.stats.sets > 0 && <Stat label="Working sets" value={String(w.stats.sets)} />}
          {w.stats.cardioMin > 0 && <Stat label="Cardio" value={fmtMinutes(w.stats.cardioMin)} />}
          {w.rpe !== null && <Stat label="Effort" value={`${w.rpe} / 10`} />}
        </div>
        <p className="mt-3 text-xs text-muted">The calories above are in your food budget for this day.</p>
      </Panel>

      <Panel title="Exercises">
        <ul className="space-y-3">
          {w.items.map((i, n) => (
            <li key={n}>
              <Link href={`/train/lifts/${i.movement.id}`} className="text-sm font-medium">{i.movement.name}</Link>
              {i.notes && <p className="text-xs text-muted">{i.notes}</p>}
              <SetList kind={i.movement.kind} sets={i.sets} />
            </li>
          ))}
        </ul>
        {w.notes && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">{w.notes}</p>}
      </Panel>

      {w.stats.sets > 0 && (
        <Panel title="Muscles worked">
          <MuscleMap values={map} describe={(m: Muscle) => `${MUSCLE_LABEL[m]}: ${w.muscles[m] ?? 0} sets`} scaleLow="0" scaleHigh={`${FULL_SESSION_SETS}+ sets`} />
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={repeat}>Repeat workout</Button>
        <Button variant="ghost" className="!bg-panel" onClick={() => setRoutineName(w.name)} disabled={saved}>{saved ? "Saved ✓" : "Save as routine"}</Button>
        <Link href={`/train/session/${id}`} className="rounded-xl bg-panel px-4 py-2 text-center text-sm font-medium text-accent">Edit</Link>
        <Button variant="danger" onClick={() => setDeleting(true)}>Delete</Button>
      </div>

      <Sheet open={routineName !== null} onClose={() => setRoutineName(null)} title="Save as routine">
        <input value={routineName ?? ""} onChange={(e) => setRoutineName(e.target.value)} aria-label="Routine name" className="w-full" />
        <Button className="mt-3 w-full" onClick={saveRoutine} disabled={!routineName?.trim()}>Save routine</Button>
      </Sheet>
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete this workout?">
        <p className="mb-4 text-sm text-muted">Its sets and its calories on {w.date} will be removed.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setDeleting(false)}>Keep it</Button>
          <Button className="!bg-danger !text-white" onClick={remove}>Delete</Button>
        </div>
      </Sheet>
    </div>
  );
}
