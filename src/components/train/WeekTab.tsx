"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, weekStart } from "@/lib/dates";
import { type Muscle, MUSCLE_LABEL } from "@/lib/train/muscles";
import type { NutritionSplit, WeekView } from "@/lib/train/views";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { Bars, MuscleBars, RegionBars } from "./charts";
import { dateShort, dayLetter, fmtMinutes, fmtVolume } from "./format";
import { Empty, InsightList, Loading, Panel, Stat } from "./kit";
import { MuscleMap } from "./MuscleMap";

const FULL_WEEK_SETS = 20;

function change(now: number, before: number): { delta?: string; deltaUp: boolean | null } {
  if (before === 0) return { delta: undefined, deltaUp: null };
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? { delta: "Same as last week", deltaUp: null } : { delta: `${Math.abs(pct)}% vs last week`, deltaUp: pct > 0 };
}

function FuelRow({ label, s }: { label: string; s: NutritionSplit }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-2 text-left font-normal">{label}<span className="block text-xs text-muted">{s.days} logged</span></th>
      <td className="tabular text-right">{s.days ? Math.round(s.avgKcal).toLocaleString() : "–"}</td>
      <td className="tabular text-right">{s.days ? `${Math.round(s.avgProtein)} g` : "–"}</td>
    </tr>
  );
}

export function WeekTab({ today }: { today: string }) {
  const [start, setStart] = useState(() => weekStart(today));
  const [data, setData] = useState<WeekView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<WeekView>(`/api/train/week?start=${start}&today=${today}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [start, today]);

  const thisWeek = weekStart(today);
  const nav = (
    <div className="flex items-center justify-between">
      <button onClick={() => setStart(addDays(start, -7))} className="px-2 text-2xl text-muted" aria-label="Previous week">‹</button>
      <h2 className="display text-2xl">{start === thisWeek ? "This week" : `${dateShort(start)} – ${dateShort(addDays(start, 6))}`}</h2>
      <button onClick={() => setStart(addDays(start, 7))} disabled={start >= thisWeek} className="px-2 text-2xl text-muted disabled:opacity-30" aria-label="Next week">›</button>
    </div>
  );
  if (!data || data.start !== start) return <div className="space-y-4">{nav}<ErrorNote message={error} /><Loading /></div>;

  const { stats: s, previous: p } = data;
  const chart = data.days.map((d) => ({ ...d, day: dayLetter(d.date), volume: Math.round(d.volume), cardioMin: Math.round(d.cardioMin) }));
  const map = Object.fromEntries(Object.entries(data.muscleMap).map(([m, v]) => [m, Math.min(1, v / FULL_WEEK_SETS)]));
  // One line per exercise: the heaviest weight says more than a list of every record type.
  const topRecords = [...new Map(data.records.filter((r) => r.type !== "volume").reverse().map((r) => [r.movementId, r])).values()];

  if (s.sessions === 0) return <div className="space-y-4">{nav}<Panel><Empty title="No workouts this week">Finished sessions build this view automatically.</Empty></Panel></div>;

  return (
    <div className="space-y-4">
      {nav}
      <Panel>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <Stat label="Sessions" value={String(s.sessions)} {...change(s.sessions, p.sessions)} />
          <Stat label="Volume" value={fmtVolume(s.volume)} {...change(s.volume, p.volume)} />
          <Stat label="Working sets" value={String(s.sets)} {...change(s.sets, p.sets)} />
          <Stat label="Time" value={fmtMinutes(s.durationMin)} {...change(s.durationMin, p.durationMin)} />
          <Stat label="Cardio" value={fmtMinutes(s.cardioMin)} {...change(s.cardioMin, p.cardioMin)} />
          <Stat label="Distance" value={`${Math.round(s.cardioKm * 10) / 10} km`} {...change(s.cardioKm, p.cardioKm)} />
          <Stat label="Burned" value={`${Math.round(s.kcal).toLocaleString()}`} delta="kcal" />
          <Stat label="Reps" value={s.reps.toLocaleString()} {...change(s.reps, p.reps)} />
        </div>
      </Panel>
      {data.insights.length > 0 && <Panel title="What stands out"><InsightList insights={data.insights} /></Panel>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Volume by day"><Bars data={chart} x="day" y="volume" name="Volume" unit="kg" /></Panel>
          {s.cardioMin > 0 && <Panel title="Cardio by day"><Bars data={chart} x="day" y="cardioMin" name="Cardio" unit="min" height={120} color="var(--burn)" /></Panel>}
          <Panel title="Split by body part"><RegionBars regions={data.regions} /></Panel>
          <Panel title="Food on training and rest days">
            <table className="w-full text-sm">
              <thead><tr className="eyebrow"><th className="pb-2 text-left font-semibold">Average</th><th className="pb-2 text-right font-semibold">Kcal</th><th className="pb-2 text-right font-semibold">Protein</th></tr></thead>
              <tbody>
                <FuelRow label="Training days" s={data.nutrition.training} />
                <FuelRow label="Rest days" s={data.nutrition.rest} />
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Your protein target is {data.nutrition.targetProtein} g a day.</p>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Muscle map"><MuscleMap values={map} describe={(m: Muscle) => `${MUSCLE_LABEL[m]}: ${data.muscleMap[m] ?? 0} sets`} scaleLow="0" scaleHigh={`${FULL_WEEK_SETS}+ sets`} /></Panel>
          <Panel title="Sets per muscle"><MuscleBars rows={data.muscles} /></Panel>
          {topRecords.length > 0 && (
            <Panel title="Records">
              <ul className="space-y-1.5 text-sm">
                {topRecords.map((r) => <li key={r.movementId} className="flex justify-between gap-3"><Link href={`/train/lifts/${r.movementId}`} className="truncate">{r.movementName}</Link><span className="tabular shrink-0 text-accent">{r.label}</span></li>)}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
