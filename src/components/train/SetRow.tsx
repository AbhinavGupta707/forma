"use client";
import type { MovementKind } from "@/lib/train/catalog";
import { e1rm, type SetData } from "@/lib/train/metrics";
import type { SetHints } from "@/lib/train/session-ops";
import { fmtKg } from "./format";
import { NumField } from "./NumField";

const KIND_MARK = { warmup: "W", drop: "D", failure: "F" } as const;
const KIND_COLOUR = { warmup: "text-warn", drop: "text-burn", failure: "text-danger" } as const;

export const GRID = "grid grid-cols-[2.25rem_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5";

interface Props {
  kind: MovementKind;
  set: SetData;
  /** 1-based number among working sets. */
  number: number;
  hints: SetHints;
  previous: string | null;
  bestE1rm: number | null;
  onChange: (patch: Partial<SetData>) => void;
  onTick: () => void;
  onOptions: () => void;
  onUsePrevious: () => void;
}

export function SetRow({ kind, set, number, hints, previous, bestE1rm, onChange, onTick, onOptions, onUsePrevious }: Props) {
  const estimate = set.done && kind === "load" ? e1rm(set.weightKg, set.reps) : null;
  const isRecord = estimate !== null && bestE1rm !== null && estimate > bestE1rm && set.kind !== "warmup";
  const hold = kind === "hold";
  return (
    <div className={`${GRID} rounded-lg py-0.5 transition-colors ${set.done ? "bg-accent-soft" : ""}`}>
      <button onClick={onOptions} aria-label={`Set ${number} options`} className="relative flex h-10 items-center justify-center font-semibold">
        {set.kind === "normal" ? <span className="tabular text-sm">{number}</span> : <span className={`text-sm ${KIND_COLOUR[set.kind]}`}>{KIND_MARK[set.kind]}</span>}
        {set.rpe !== null && <span className="tabular absolute -bottom-0.5 text-[9px] text-muted">@{set.rpe}</span>}
      </button>
      <button onClick={onUsePrevious} disabled={!previous} className="tabular truncate text-center text-xs text-muted" aria-label={previous ? `Use previous, ${previous}` : "No previous set"}>
        {isRecord ? <span className="pop inline-block rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-on-accent">RECORD</span> : previous ?? "–"}
      </button>
      {hold
        ? <NumField label="Seconds" integer value={set.durationSec} onChange={(v) => onChange({ durationSec: v })} />
        : <NumField label="Weight in kg" value={set.weightKg} hint={hints.weightKg} onChange={(v) => onChange({ weightKg: v })} />}
      {hold
        ? <NumField label="Added weight in kg" value={set.weightKg} onChange={(v) => onChange({ weightKg: v })} />
        : <NumField label="Reps" integer value={set.reps} hint={hints.reps} onChange={(v) => onChange({ reps: v })} />}
      <button onClick={onTick} aria-label={set.done ? `Undo set ${number}` : `Complete set ${number}`} aria-pressed={set.done}
        className={`flex h-10 w-11 items-center justify-center rounded-lg text-lg font-bold transition active:scale-90 ${set.done ? "bg-accent text-on-accent" : "bg-panel text-muted"}`}>✓</button>
    </div>
  );
}

export const previousText = (kind: MovementKind, s: SetData | undefined): string | null => {
  if (!s) return null;
  if (kind === "hold") return `${s.durationSec ?? 0}s`;
  if (kind === "load") return `${fmtKg(s.weightKg)} × ${s.reps ?? 0}`;
  return s.weightKg ? `${kind === "assisted" ? "−" : "+"}${fmtKg(s.weightKg)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
};
