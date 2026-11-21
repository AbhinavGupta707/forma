"use client";
import { cardioSetKcal, type SetData } from "@/lib/train/metrics";
import type { Movement } from "@/lib/train/movements";
import { NumField } from "./NumField";

interface Props {
  movement: Movement;
  set: SetData;
  bodyKg: number;
  onChange: (patch: Partial<SetData>) => void;
  onTick: () => void;
  onRemove: (() => void) | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="eyebrow mb-1 block text-center !text-[10px]">{label}</span>{children}</label>;
}

export function CardioRow({ movement, set, bodyKg, onChange, onTick, onRemove }: Props) {
  const treadmill = movement.key === "treadmill";
  const estimate = Math.round(cardioSetKcal({ ...set, kcal: null }, movement.met ?? 6, bodyKg, treadmill));
  return (
    <div className={`rounded-lg p-2 transition-colors ${set.done ? "bg-accent-soft" : ""}`}>
      <div className="grid grid-cols-3 gap-1.5">
        <Field label="Minutes">
          <NumField label="Minutes" value={set.durationSec === null ? null : Math.round((set.durationSec / 60) * 10) / 10}
            onChange={(v) => onChange({ durationSec: v === null ? null : v * 60 })} />
        </Field>
        <Field label="Km"><NumField label="Distance in km" value={set.distanceKm} onChange={(v) => onChange({ distanceKm: v })} /></Field>
        <Field label="Kcal"><NumField label="Calories from the machine" value={set.kcal} hint={estimate || null} onChange={(v) => onChange({ kcal: v })} /></Field>
        {treadmill && <Field label="Km/h"><NumField label="Speed in km per hour" value={set.speedKmh} onChange={(v) => onChange({ speedKmh: v })} /></Field>}
        {treadmill && <Field label="Incline %"><NumField label="Incline percent" value={set.inclinePct} onChange={(v) => onChange({ inclinePct: v })} /></Field>}
        <div className="flex items-end gap-1.5 [grid-column:-2/-1]">
          {onRemove && <button onClick={onRemove} aria-label="Remove this entry" className="h-10 w-9 shrink-0 rounded-lg bg-panel text-muted">×</button>}
          <button onClick={onTick} aria-pressed={set.done} aria-label={set.done ? "Undo" : "Complete"}
            className={`h-10 flex-1 rounded-lg text-lg font-bold transition active:scale-90 ${set.done ? "bg-accent text-on-accent" : "bg-panel text-muted"}`}>✓</button>
        </div>
      </div>
    </div>
  );
}
