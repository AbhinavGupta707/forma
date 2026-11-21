"use client";
import Link from "next/link";
import { useState } from "react";
import type { MovementContext } from "@/lib/train/history";
import type { SetData } from "@/lib/train/metrics";
import { completeSet, hintsFor } from "@/lib/train/session-ops";
import { MUSCLE_LABEL } from "@/lib/train/muscles";
import type { WorkoutItem } from "@/lib/train/workouts";
import { Button, Sheet } from "@/components/ui";
import { CardioRow } from "./CardioRow";
import { dateShort, fmtKg } from "./format";
import { SetSheet } from "./SetSheet";
import { setText } from "./SetList";
import { GRID, previousText, SetRow } from "./SetRow";

const REST_OPTIONS = [0, 45, 60, 90, 120, 150, 180, 240, 300];

interface Props {
  item: WorkoutItem;
  index: number;
  count: number;
  context: MovementContext | undefined;
  bodyKg: number;
  linkedToNext: boolean;
  onSet: (s: number, patch: Partial<SetData>) => void;
  /** Called when a set is ticked on, so the rest timer can start. */
  onCompleted: () => void;
  onAddSet: () => void;
  onRemoveSet: (s: number) => void;
  onPatch: (patch: Partial<WorkoutItem>) => void;
  onMove: (to: number) => void;
  onSuperset: () => void;
  onRemove: () => void;
}

function Menu(p: Props & { open: boolean; onClose: () => void }) {
  const row = "block w-full rounded-lg bg-panel px-3 py-2.5 text-left text-sm disabled:opacity-40";
  const act = (fn: () => void) => () => { fn(); p.onClose(); };
  return (
    <Sheet open={p.open} onClose={p.onClose} title={p.item.movement.name}>
      <div className="space-y-2">
        {p.item.movement.kind !== "cardio" && (
          <label className="block text-sm">
            <span className="eyebrow mb-1 block">Rest timer</span>
            <select value={p.item.restSec} onChange={(e) => p.onPatch({ restSec: Number(e.target.value) })} className="w-full">
              {REST_OPTIONS.map((s) => <option key={s} value={s}>{s === 0 ? "Off" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</option>)}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="eyebrow mb-1 block">Notes</span>
          <input value={p.item.notes} onChange={(e) => p.onPatch({ notes: e.target.value })} placeholder="Seat height, grip, how it felt" className="w-full" />
        </label>
        <button className={row} disabled={p.index === 0} onClick={act(() => p.onMove(p.index - 1))}>Move up</button>
        <button className={row} disabled={p.index === p.count - 1} onClick={act(() => p.onMove(p.index + 1))}>Move down</button>
        <button className={row} disabled={p.index === p.count - 1 && !p.linkedToNext} onClick={act(p.onSuperset)}>
          {p.linkedToNext ? "Remove superset" : "Superset with next exercise"}
        </button>
        <Link className={row} href={`/train/lifts/${p.item.movement.id}`}>History and progress</Link>
        <Button variant="danger" className="w-full" onClick={act(p.onRemove)}>Remove exercise</Button>
      </div>
    </Sheet>
  );
}

export function ExerciseCard(p: Props) {
  const { item, context } = p;
  const [menu, setMenu] = useState(false);
  const [optionsFor, setOptionsFor] = useState<number | null>(null);
  const { kind } = item.movement;
  const prev = context?.previous?.sets;
  const prevWorking = prev?.filter((s) => s.kind !== "warmup") ?? [];
  const nextEmpty = item.sets.findIndex((s) => !s.done && s.weightKg === null && s.reps === null);
  const suggestion = context?.suggestion;
  const lastCardio = kind === "cardio" ? prev?.at(-1) : undefined;
  const nextEmptyCardio = item.sets.findIndex((s) => !s.done && s.durationSec === null && s.distanceKm === null);
  const muscle = item.movement.primary === "cardio" ? "Cardio" : MUSCLE_LABEL[item.movement.primary];

  function tick(s: number) {
    const set = item.sets[s];
    if (set.done) return p.onSet(s, { done: false });
    const done = completeSet(kind, set, hintsFor(prev, workingIndex(s), item.targetReps, set.kind));
    if (!done) return;
    p.onSet(s, done);
    p.onCompleted();
  }
  const workingIndex = (s: number) => item.sets.slice(0, s).filter((x) => x.kind === item.sets[s].kind || (x.kind !== "warmup" && item.sets[s].kind !== "warmup")).length;
  const setNumber = (s: number) => item.sets.slice(0, s + 1).filter((x) => x.kind !== "warmup").length || s + 1;

  return (
    <section className={`rounded-xl border bg-card p-3 ${item.supersetId !== null ? "border-accent/50" : "border-line"}`}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {item.supersetId !== null && <p className="eyebrow !text-accent">Superset</p>}
          <h3 className="display truncate text-[1.45rem]">{item.movement.name}</h3>
          <p className="text-xs text-muted">
            {muscle}
            {context?.previous ? ` · last ${dateShort(context.previous.date)}` : ""}
            {item.restSec > 0 ? ` · rest ${Math.floor(item.restSec / 60)}:${String(item.restSec % 60).padStart(2, "0")}` : ""}
          </p>
        </div>
        <button onClick={() => setMenu(true)} aria-label={`${item.movement.name} options`} className="h-9 w-9 shrink-0 rounded-lg bg-panel text-muted">⋯</button>
      </header>

      {item.notes && <p className="mb-2 text-xs text-muted">{item.notes}</p>}

      {suggestion && nextEmpty >= 0 && kind !== "cardio" && (
        <button onClick={() => p.onSet(nextEmpty, { weightKg: suggestion.weightKg || null, reps: suggestion.reps })}
          className="mb-2 w-full rounded-lg bg-panel px-3 py-2 text-left text-xs">
          <span className="font-semibold text-accent">Try {suggestion.weightKg ? `${fmtKg(suggestion.weightKg)} kg × ` : ""}{suggestion.reps}</span>
          <span className="text-muted"> · {suggestion.reason}</span>
        </button>
      )}

      {kind === "cardio" && lastCardio && nextEmptyCardio >= 0 && (
        <button onClick={() => p.onSet(nextEmptyCardio, { durationSec: lastCardio.durationSec, distanceKm: lastCardio.distanceKm, speedKmh: lastCardio.speedKmh, inclinePct: lastCardio.inclinePct, kcal: lastCardio.kcal })}
          className="mb-2 w-full rounded-lg bg-panel px-3 py-2 text-left text-xs">
          <span className="font-semibold text-accent">Same as last time</span>
          <span className="text-muted"> · {setText("cardio", lastCardio)}</span>
        </button>
      )}

      {kind === "cardio" ? (
        <div className="space-y-1">
          {item.sets.map((set, s) => (
            <CardioRow key={s} movement={item.movement} set={set} bodyKg={p.bodyKg} onChange={(patch) => p.onSet(s, patch)} onTick={() => tick(s)}
              onRemove={item.sets.length > 1 ? () => p.onRemoveSet(s) : null} />
          ))}
        </div>
      ) : (
        <>
          <div className={`${GRID} eyebrow !text-[10px] pb-1 text-center`}>
            <span>Set</span><span>Previous</span>
            <span>{kind === "hold" ? "Sec" : kind === "assisted" ? "−Kg" : kind === "bodyweight" ? "+Kg" : "Kg"}</span>
            <span>{kind === "hold" ? "+Kg" : "Reps"}</span><span />
          </div>
          <div className="space-y-1">
            {item.sets.map((set, s) => {
              const hints = hintsFor(prev, workingIndex(s), item.targetReps, set.kind);
              const match = set.kind === "warmup" ? prev?.filter((x) => x.kind === "warmup")[workingIndex(s)] : prevWorking[workingIndex(s)];
              return (
                <SetRow key={s} kind={kind} set={set} number={setNumber(s)} hints={hints} previous={previousText(kind, match)}
                  bestE1rm={context?.bestE1rm ?? null} onChange={(patch) => p.onSet(s, patch)} onTick={() => tick(s)} onOptions={() => setOptionsFor(s)}
                  onUsePrevious={() => match && p.onSet(s, { weightKg: match.weightKg, reps: match.reps })} />
              );
            })}
          </div>
        </>
      )}

      <button onClick={p.onAddSet} className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-accent">+ Add {kind === "cardio" ? "interval" : "set"}</button>

      <Menu {...p} open={menu} onClose={() => setMenu(false)} />
      <SetSheet set={optionsFor === null ? null : item.sets[optionsFor] ?? null} onClose={() => setOptionsFor(null)}
        onChange={(patch) => optionsFor !== null && p.onSet(optionsFor, patch)}
        onDelete={() => { if (optionsFor !== null) p.onRemoveSet(optionsFor); setOptionsFor(null); }} />
    </section>
  );
}
