"use client";
import { useState } from "react";
import { estimateWorkoutKcal, hasData, isWorking, setVolume } from "@/lib/train/metrics";
import type { Workout } from "@/lib/train/workouts";
import { api, errorMessage } from "@/components/client";
import { Button, ErrorNote, Sheet } from "@/components/ui";
import { fmtVolume } from "./format";
import { NumField } from "./NumField";

const EFFORT = [5, 6, 7, 8, 9, 10];
const DEFAULT_RETRO_MIN = 60;

interface Props {
  open: boolean;
  workout: Workout;
  bodyKg: number;
  nowMs: number;
  onClose: () => void;
  beforeFinish: () => Promise<void>;
  onFinished: () => void;
}

export function FinishSheet({ open, workout: w, bodyKg, nowMs, onClose, beforeFinish, onFinished }: Props) {
  const cardioMin = w.items.reduce((m, i) => m + (i.movement.kind === "cardio" ? i.sets.reduce((s, x) => s + (x.durationSec ?? 0) / 60, 0) : 0), 0);
  const clock = w.startedAt ? Math.round((nowMs - Date.parse(w.startedAt)) / 60_000) : DEFAULT_RETRO_MIN;
  // Cardio typed in afterwards can be longer than the time the session was open.
  const elapsed = Math.max(1, clock, Math.round(cardioMin));
  const [minutes, setMinutes] = useState<number | null>(w.durationMin);
  const [rpe, setRpe] = useState<number | null>(w.rpe);
  const [notes, setNotes] = useState(w.notes);
  // When editing, keep the saved figure unless it's changed here.
  const [kcal, setKcal] = useState<number | null>(w.status === "done" ? w.kcal : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duration = minutes ?? elapsed;
  const counted = w.items.map((i) => ({ ...i, sets: i.sets.filter(hasData).map((s) => ({ ...s, done: true })) }));
  const unticked = w.items.reduce((n, i) => n + i.sets.filter((s) => hasData(s) && !s.done).length, 0);
  const estimate = estimateWorkoutKcal({
    durationMin: duration, weightKg: bodyKg,
    items: counted.map((i) => ({ kind: i.movement.kind, met: i.movement.met, treadmill: i.movement.key === "treadmill", sets: i.sets })),
  });
  const sets = counted.reduce((n, i) => n + (i.movement.kind === "cardio" ? 0 : i.sets.filter(isWorking).length), 0);
  const volume = counted.reduce((v, i) => v + i.sets.filter(isWorking).reduce((s, set) => s + setVolume(i.movement.kind, set, bodyKg), 0), 0);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await beforeFinish();
      await api.post(`/api/train/workouts/${w.id}/finish`, { durationMin: duration, rpe, notes, kcal });
      onFinished();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={w.status === "done" ? "Save changes" : "Finish workout"}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-panel p-2"><dd className="display tabular text-2xl">{sets}</dd><dt className="eyebrow">Sets</dt></div>
          <div className="rounded-lg bg-panel p-2"><dd className="display tabular text-2xl">{fmtVolume(volume)}</dd><dt className="eyebrow">Volume</dt></div>
        </dl>
        {unticked > 0 && <p className="text-xs text-muted">{unticked} filled-in set{unticked === 1 ? "" : "s"} not ticked will be counted. Empty sets are removed.</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="eyebrow mb-1 block">Minutes</span>
            <NumField label="Duration in minutes" integer value={minutes} hint={elapsed} onChange={setMinutes} /></label>
          <label className="block"><span className="eyebrow mb-1 block">Calories burned</span>
            <NumField label="Calories burned" integer value={kcal} hint={estimate} onChange={setKcal} /></label>
        </div>
        <p className="-mt-2 text-xs text-muted">Estimated above what you&apos;d burn at rest, then added to your food budget for {w.date}. Type your own figure to replace it.</p>
        <div>
          <p className="eyebrow mb-2">How hard was it?</p>
          <div className="grid grid-cols-6 gap-1.5">
            {EFFORT.map((r) => (
              <button key={r} onClick={() => setRpe(rpe === r ? null : r)} aria-pressed={rpe === r}
                className={`tabular rounded-lg py-2 text-sm ${rpe === r ? "bg-accent text-on-accent" : "bg-panel"}`}>{r}</button>
            ))}
          </div>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" aria-label="Workout notes" className="w-full resize-none" />
        <ErrorNote message={error} />
        <Button className="w-full !py-3" onClick={finish} disabled={busy}>{busy ? "Saving…" : w.status === "done" ? "Save changes" : "Finish workout"}</Button>
      </div>
    </Sheet>
  );
}
