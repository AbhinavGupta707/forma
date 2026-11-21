"use client";
import type { MovementKind } from "@/lib/train/catalog";
import { e1rm, type SetData } from "@/lib/train/metrics";
import { fmtKg, fmtMinutes } from "./format";

export function setText(kind: MovementKind, s: SetData): string {
  if (kind === "cardio") {
    const parts = [
      s.durationSec ? fmtMinutes(s.durationSec / 60) : null,
      s.distanceKm ? `${s.distanceKm} km` : null,
      s.speedKmh ? `${s.speedKmh} km/h` : null,
      s.inclinePct ? `${s.inclinePct}% incline` : null,
      s.kcal ? `${s.kcal} kcal` : null,
    ];
    return parts.filter(Boolean).join(" · ");
  }
  if (kind === "hold") return `${s.durationSec ?? 0} s${s.weightKg ? ` + ${fmtKg(s.weightKg)} kg` : ""}`;
  if (kind === "load") return `${fmtKg(s.weightKg)} kg × ${s.reps ?? 0}`;
  const extra = s.weightKg ? ` (${kind === "assisted" ? "−" : "+"}${fmtKg(s.weightKg)} kg)` : "";
  return `${s.reps ?? 0} reps${extra}`;
}

const KIND_LABEL = { warmup: "Warm-up", drop: "Drop", failure: "Failure" } as const;

export function SetList({ kind, sets }: { kind: MovementKind; sets: SetData[] }) {
  const number = (i: number) => sets.slice(0, i + 1).filter((s) => s.kind !== "warmup").length;
  return (
    <ol className="mt-1 space-y-0.5">
      {sets.map((s, i) => {
        const est = kind === "load" && s.kind !== "warmup" ? e1rm(s.weightKg, s.reps) : null;
        return (
          <li key={i} className="tabular flex justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="mr-2 inline-block w-4 text-xs text-muted">{s.kind === "warmup" ? "W" : number(i)}</span>
              {setText(kind, s)}
              {s.rpe !== null && <span className="ml-1 text-xs text-muted">@{s.rpe}</span>}
              {s.kind !== "normal" && <span className="ml-2 text-xs text-muted">{KIND_LABEL[s.kind]}</span>}
            </span>
            {est !== null && <span className="shrink-0 text-xs text-muted">≈ {Math.round(est)} kg 1RM</span>}
          </li>
        );
      })}
    </ol>
  );
}
