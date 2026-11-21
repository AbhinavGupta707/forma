"use client";
import { useState } from "react";
import { type Muscle, MUSCLE_LABEL } from "@/lib/train/muscles";

type Shape = [Muscle | null, string];

// Faceted figure, drawn for the left half and mirrored. 200 × 412 grid per view; null shapes are not muscles.
const FRONT: Shape[] = [
  [null, "100,6 86,12 83,30 90,44 100,48"],
  ["traps", "99,50 90,47 84,60 99,62"],
  ["shoulders", "82,61 63,64 52,78 55,99 71,92 78,75"],
  ["chest", "98,65 84,63 79,76 72,93 78,108 98,113"],
  ["biceps", "54,102 70,95 71,128 62,147 50,141 47,119"],
  ["forearms", "48,145 62,151 58,190 50,211 39,208 37,178"],
  [null, "39,212 50,215 48,234 35,231"],
  ["abs", "85,115 98,117 98,139 84,137"],
  ["abs", "84,140 98,142 98,164 84,162"],
  ["abs", "85,165 98,167 98,198 89,190"],
  ["abs", "77,111 82,114 81,136 81,162 85,187 75,175 71,146"],
  ["quads", "65,212 75,197 84,201 83,296 70,297 61,252"],
  ["quads", "86,205 91,236 90,298 85,298"],
  ["adductors", "87,203 98,209 97,250 93,262"],
  ["calves", "67,307 83,307 81,368 72,388 63,350"],
  [null, "71,392 84,392 86,406 65,406"],
];

const BACK: Shape[] = [
  [null, "100,6 86,12 83,30 90,44 100,48"],
  ["traps", "99,48 90,48 77,61 91,67 99,100"],
  ["rear_delts", "76,62 61,66 52,79 55,98 71,90"],
  ["upper_back", "90,69 75,73 72,91 98,103"],
  ["lats", "71,94 78,122 88,150 98,152 98,106"],
  ["triceps", "54,102 70,94 72,128 62,147 50,141 47,119"],
  ["forearms", "48,145 62,151 58,190 50,211 39,208 37,178"],
  [null, "39,212 50,215 48,234 35,231"],
  ["lower_back", "87,154 98,155 98,187 83,187"],
  ["glutes", "72,190 98,190 98,241 82,245 67,228"],
  ["hamstrings", "65,247 83,249 82,306 70,305 61,272"],
  ["hamstrings", "85,249 97,247 94,304 84,307"],
  ["calves", "66,313 83,313 84,350 76,388 67,356"],
  [null, "71,392 84,392 86,406 65,406"],
];

interface Props {
  /** 0–1 per muscle. */
  values: Partial<Record<Muscle, number>>;
  tint?: "accent" | "burn";
  /** Text shown when a muscle is tapped. */
  describe: (m: Muscle) => string;
  scaleLow: string;
  scaleHigh: string;
}

const fill = (v: number, tint: string) =>
  v <= 0 ? "var(--panel)" : `color-mix(in oklab, var(--${tint}) ${Math.round(18 + v * 82)}%, var(--panel))`;

function Figure({ shapes, values, tint, picked, onPick, label }: {
  shapes: Shape[];
  values: Props["values"];
  tint: string;
  picked: Muscle | null;
  onPick: (m: Muscle) => void;
  label: string;
}) {
  const draw = (mirror: boolean) => shapes.map(([m, points], i) => (
    <polygon key={`${mirror}${i}`} points={points}
      fill={m ? fill(values[m] ?? 0, tint) : "var(--line)"}
      stroke={m && m === picked ? "var(--fg)" : "var(--card)"} strokeWidth={m && m === picked ? 1.6 : 1.4} strokeLinejoin="round"
      onClick={m ? () => onPick(m) : undefined} className={m ? "cursor-pointer transition-[fill] duration-300" : undefined}>
      {m && <title>{MUSCLE_LABEL[m]}</title>}
    </polygon>
  ));
  return (
    <figure className="min-w-0 flex-1">
      <svg viewBox="26 0 148 412" className="mx-auto block h-auto w-full max-w-44" role="img" aria-label={`${label} muscle map`}>
        <g>{draw(false)}</g>
        <g transform="translate(200 0) scale(-1 1)">{draw(true)}</g>
      </svg>
      <figcaption className="eyebrow mt-1 text-center">{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ values, tint = "accent", describe, scaleLow, scaleHigh }: Props) {
  const [picked, setPicked] = useState<Muscle | null>(null);
  return (
    <div>
      <div className="flex gap-2">
        <Figure shapes={FRONT} values={values} tint={tint} picked={picked} onPick={setPicked} label="Front" />
        <Figure shapes={BACK} values={values} tint={tint} picked={picked} onPick={setPicked} label="Back" />
      </div>
      <p className="mt-3 min-h-5 text-center text-sm">{picked ? describe(picked) : <span className="text-muted">Tap a muscle for details</span>}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span>{scaleLow}</span>
        <span className="h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, var(--panel), var(--${tint}))` }} />
        <span>{scaleHigh}</span>
      </div>
    </div>
  );
}
