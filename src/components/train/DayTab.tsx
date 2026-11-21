"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays } from "@/lib/dates";
import { type Muscle, MUSCLE_LABEL } from "@/lib/train/muscles";
import type { DayView } from "@/lib/train/views";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { dateLong, fmtMinutes, fmtVolume } from "./format";
import { Empty, Loading, Panel, Stat } from "./kit";
import { MuscleMap } from "./MuscleMap";
import { SetList } from "./SetList";

const FULL_SESSION_SETS = 10;

export function DayTab({ date, today, onDate }: { date: string; today: string; onDate: (d: string) => void }) {
  const [data, setData] = useState<DayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<DayView>(`/api/train/day?date=${date}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [date]);

  const nav = (
    <div className="flex items-center justify-between">
      <button onClick={() => onDate(addDays(date, -1))} className="px-2 text-2xl text-muted" aria-label="Previous day">‹</button>
      <h2 className="display text-2xl">{date === today ? "Today" : dateLong(date)}</h2>
      <button onClick={() => onDate(addDays(date, 1))} disabled={date >= today} className="px-2 text-2xl text-muted disabled:opacity-30" aria-label="Next day">›</button>
    </div>
  );
  if (!data || data.date !== date) return <div className="space-y-4">{nav}<ErrorNote message={error} /><Loading /></div>;

  const totals = data.workouts.reduce((t, w) => ({
    minutes: t.minutes + (w.durationMin ?? 0), sets: t.sets + w.stats.sets, volume: t.volume + w.stats.volume,
  }), { minutes: 0, sets: 0, volume: 0 });
  const map = Object.fromEntries(Object.entries(data.muscleMap).map(([m, v]) => [m, Math.min(1, v / FULL_SESSION_SETS)]));
  const { nutrition: n } = data;

  return (
    <div className="space-y-4">
      {nav}
      {data.workouts.length === 0 && data.other.length === 0 ? (
        <Panel><Empty title="Rest day">Nothing logged. Recovery is part of training.</Empty></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {data.workouts.length > 0 && (
              <Panel>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Time" value={fmtMinutes(totals.minutes)} />
                  <Stat label="Sets" value={String(totals.sets)} />
                  <Stat label="Volume" value={fmtVolume(totals.volume)} />
                </div>
              </Panel>
            )}
            {data.workouts.map((w) => (
              <Panel key={w.id} title={w.name} action={<Link href={`/train/workout/${w.id}`} className="text-xs text-accent">Open</Link>}>
                <ul className="space-y-3">
                  {w.items.map((i, n2) => (
                    <li key={n2}>
                      <Link href={`/train/lifts/${i.movement.id}`} className="text-sm font-medium">{i.movement.name}</Link>
                      <SetList kind={i.movement.kind} sets={i.sets} />
                    </li>
                  ))}
                </ul>
                {w.records.length > 0 && <p className="mt-3 text-xs text-accent">{w.records.length} record{w.records.length === 1 ? "" : "s"} in this session</p>}
              </Panel>
            ))}
            {data.other.length > 0 && (
              <Panel title="Also logged on Today">
                <ul className="space-y-1 text-sm">{data.other.map((o, i) => <li key={i} className="flex justify-between"><span>{o.label}{o.minutes ? ` · ${Math.round(o.minutes)} min` : ""}</span><span className="tabular text-muted">{Math.round(o.kcal)} kcal</span></li>)}</ul>
              </Panel>
            )}
          </div>
          <div className="space-y-4">
            <Panel title="Fuel that day">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Eaten" value={`${Math.round(n.kcal)}`} delta={`of ${Math.round(n.budget)} kcal`} />
                <Stat label="Burned" value={`${Math.round(data.burned)}`} delta="kcal in workouts" />
                <Stat label="Protein" value={`${Math.round(n.protein)} g`} delta={`of ${Math.round(n.targetProtein)} g`} />
              </div>
            </Panel>
            {data.workouts.length > 0 && (
              <Panel title="Muscles worked">
                <MuscleMap values={map} describe={(m: Muscle) => `${MUSCLE_LABEL[m]}: ${data.muscleMap[m] ?? 0} sets`} scaleLow="0" scaleHigh={`${FULL_SESSION_SETS}+ sets`} />
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
