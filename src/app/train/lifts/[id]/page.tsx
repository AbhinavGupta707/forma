"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LiftDetail } from "@/lib/train/lifts";
import { MUSCLE_LABEL } from "@/lib/train/muscles";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { Bars, Trend } from "@/components/train/charts";
import { dateShort, fmtKg, fmtMinutes, fmtVolume } from "@/components/train/format";
import { BackLink, Empty, Loading, Panel, Stat } from "@/components/train/kit";
import { SetList } from "@/components/train/SetList";

/** Weights you could expect at each rep count from the best estimate (Epley, reversed). */
const PROJECTED_REPS = [1, 3, 5, 8, 10, 12];
const project = (oneRm: number, reps: number) => (reps === 1 ? oneRm : oneRm / (1 + reps / 30));

function StrengthPanels({ d }: { d: LiftDetail }) {
  const series = d.series.filter((p) => p.e1rm !== null).map((p) => ({ ...p, label: dateShort(p.date), est: Math.round(p.e1rm! * 10) / 10 }));
  const volume = d.series.map((p) => ({ label: dateShort(p.date), volume: Math.round(p.volume) }));
  const e1rmRecords = d.records.filter((r) => r.type === "e1rm").map((r) => ({ x: dateShort(r.date), y: Math.round(r.value * 10) / 10 }));
  const best = d.bestE1rm;
  return (
    <>
      {series.length >= 2 && <Panel title="Estimated one-rep max"><Trend data={series} x="label" y="est" name="Est. 1RM" unit="kg" marks={e1rmRecords} /><p className="mt-1 text-xs text-muted">Rings mark records.</p></Panel>}
      {volume.length >= 2 && <Panel title="Volume per session"><Bars data={volume} x="label" y="volume" name="Volume" unit="kg" height={130} /></Panel>}
      {best !== null && (
        <Panel title="Rep maxes">
          <table className="tabular w-full text-sm">
            <thead><tr className="eyebrow"><th className="pb-1 text-left font-semibold">Reps</th><th className="pb-1 text-right font-semibold">Your best</th><th className="pb-1 text-right font-semibold">Estimated</th></tr></thead>
            <tbody>{PROJECTED_REPS.map((reps) => {
              const actual = d.repBests.find((b) => b.reps === reps);
              return <tr key={reps} className="border-t border-line"><td className="py-1.5">{reps}</td><td className="text-right">{actual ? `${fmtKg(actual.weightKg)} kg` : "–"}</td><td className="text-right text-muted">{Math.round(project(best, reps))} kg</td></tr>;
            })}</tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

function CardioPanels({ d }: { d: LiftDetail }) {
  const chart = d.cardio.map((c) => ({ ...c, label: dateShort(c.date), minutes: Math.round(c.minutes) }));
  const distance = chart.filter((c) => c.km > 0);
  return (
    <>
      {chart.length >= 2 && <Panel title="Minutes per session"><Bars data={chart} x="label" y="minutes" name="Time" unit="min" color="var(--burn)" /></Panel>}
      {distance.length >= 2 && <Panel title="Distance per session"><Trend data={distance} x="label" y="km" name="Distance" unit="km" height={150} color="var(--burn)" /></Panel>}
    </>
  );
}

export default function LiftPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<LiftDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<LiftDetail>(`/api/train/lifts/${id}`).then(setD).catch((e) => setError(errorMessage(e)));
  }, [id]);
  if (!d) return error ? <ErrorNote message={error} /> : <Loading />;

  const { movement: m } = d;
  const cardio = m.kind === "cardio";
  const muscles = m.primary === "cardio" ? "Cardio" : [m.primary, ...m.secondary].map((x) => MUSCLE_LABEL[x]).join(", ");
  const topWeight = Math.max(0, ...d.series.map((p) => p.topWeight));
  const totalVolume = d.series.reduce((s, p) => s + p.volume, 0);
  const minutes = d.cardio.reduce((s, c) => s + c.minutes, 0);
  const km = d.cardio.reduce((s, c) => s + c.km, 0);

  return (
    <div className="rise space-y-4">
      <BackLink href="/train/insights?view=lifts" label="Exercises" />
      <header>
        <h1 className="display text-5xl">{m.name}</h1>
        <p className="mt-2 text-sm text-muted">{muscles}</p>
      </header>
      {d.sessions.length === 0 ? <Panel><Empty title="Not logged yet">Progress appears here after your first session.</Empty></Panel> : (
        <>
          <Panel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Stat label="Sessions" value={String(d.series.length || d.cardio.length)} />
              {cardio ? <Stat label="Total time" value={fmtMinutes(minutes)} /> : <Stat label="Best est. 1RM" value={d.bestE1rm ? `${Math.round(d.bestE1rm)} kg` : "–"} />}
              {cardio ? <Stat label="Total distance" value={`${Math.round(km * 10) / 10} km`} /> : <Stat label="Heaviest" value={topWeight ? `${fmtKg(topWeight)} kg` : "–"} />}
              {!cardio && <Stat label="Total volume" value={fmtVolume(totalVolume)} />}
            </div>
          </Panel>
          {cardio ? <CardioPanels d={d} /> : <StrengthPanels d={d} />}
          <Panel title="History">
            <ul className="space-y-3">
              {d.sessions.map((s) => (
                <li key={s.workoutId}>
                  <Link href={`/train/workout/${s.workoutId}`} className="text-sm font-medium">{dateShort(s.date)}</Link>
                  <SetList kind={m.kind} sets={s.sets} />
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
