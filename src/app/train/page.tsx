"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type Muscle, MUSCLE_LABEL } from "@/lib/train/muscles";
import type { Routine } from "@/lib/train/routines";
import type { Overview } from "@/lib/train/views";
import { api, errorMessage } from "@/components/client";
import { Button, ErrorNote, Sheet } from "@/components/ui";
import { dateLong, dateShort, dayLetter, fmtMinutes, fmtVolume, useToday } from "@/components/train/format";
import { Empty, InsightList, Loading, Panel, Segment, Stat } from "@/components/train/kit";
import { MuscleMap } from "@/components/train/MuscleMap";
import { VoiceBox } from "@/components/train/VoiceBox";

const FULL_WEEK_SETS = 20;

function WeekStrip({ data, today }: { data: Overview; today: string }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {data.days.map((d) => {
        const trained = d.sessions.length > 0 || d.cardioMin > 0;
        return (
          <li key={d.date}>
            <Link href={`/train/insights?view=day&date=${d.date}`} aria-label={`${dateLong(d.date)}${trained ? ", trained" : ""}`}
              className={`flex flex-col items-center rounded-lg py-2 text-xs ${trained ? "bg-accent font-semibold text-on-accent" : d.date === today ? "bg-panel text-fg" : "text-muted"}`}>
              <span>{dayLetter(d.date)}</span>
              <span className="tabular mt-0.5 text-sm">{Number(d.date.slice(8))}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function RoutineTile({ r, onStart }: { r: Routine; onStart: (id: number) => void }) {
  const sets = r.items.reduce((n, i) => n + i.sets, 0);
  return (
    <div className="flex w-56 shrink-0 flex-col justify-between rounded-xl border border-line bg-card p-3">
      <Link href={`/train/routines/${r.id}`} className="block min-w-0">
        <p className="display truncate text-2xl">{r.name}</p>
        <p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted">{r.items.map((i) => i.movement.name).join(", ")}</p>
        <p className="mt-2 text-xs text-muted">{r.items.length} exercises · {sets} sets{r.lastDone ? ` · last ${dateShort(r.lastDone)}` : ""}</p>
      </Link>
      <button onClick={() => onStart(r.id)} className="mt-3 rounded-lg bg-panel py-2 text-sm font-medium text-accent">Start</button>
    </div>
  );
}

function PastSheet({ open, today, onClose, onStart }: { open: boolean; today: string; onClose: () => void; onStart: (date: string) => void }) {
  const [date, setDate] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Log a past workout">
      <label className="block text-sm"><span className="eyebrow mb-1 block">Date</span>
        <input type="date" max={today} value={date || today} onChange={(e) => setDate(e.target.value)} className="w-full" /></label>
      <Button className="mt-3 w-full" onClick={() => onStart(date || today)}>Continue</Button>
    </Sheet>
  );
}

function deltaText(now: number, before: number, unit: string): string | undefined {
  return before > 0 || now > 0 ? `${Math.abs(Math.round(now - before)).toLocaleString()}${unit} vs last week` : undefined;
}

function WeekPanel({ d }: { d: Overview }) {
  const { week: w, lastWeek: l } = d;
  const up = (a: number, b: number) => (a === b ? null : a > b);
  return (
    <Panel title="This week" action={<Link href="/train/insights?view=week" className="text-xs text-accent">Week view</Link>}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat label="Sessions" value={String(w.sessions)} delta={deltaText(w.sessions, l.sessions, "")} deltaUp={up(w.sessions, l.sessions)} />
        <Stat label="Volume" value={fmtVolume(w.volume)} delta={deltaText(w.volume, l.volume, " kg")} deltaUp={up(w.volume, l.volume)} />
        <Stat label="Working sets" value={String(w.sets)} delta={deltaText(w.sets, l.sets, "")} deltaUp={up(w.sets, l.sets)} />
        <Stat label="Cardio" value={fmtMinutes(w.cardioMin)} delta={deltaText(w.cardioMin, l.cardioMin, " min")} deltaUp={up(w.cardioMin, l.cardioMin)} />
      </div>
    </Panel>
  );
}

function BodyPanel({ d }: { d: Overview }) {
  const [mode, setMode] = useState<"volume" | "recovery">("volume");
  const volume = Object.fromEntries(Object.entries(d.muscles).map(([m, v]) => [m, Math.min(1, v / FULL_WEEK_SETS)]));
  const fatigue = Object.fromEntries(Object.entries(d.recovery).map(([m, v]) => [m, 1 - v]));
  return (
    <Panel title="Your body">
      <div className="mb-3"><Segment label="Map view" value={mode} onChange={setMode} options={[{ value: "volume", label: "Sets this week" }, { value: "recovery", label: "Recovery" }]} /></div>
      {mode === "volume"
        ? <MuscleMap values={volume} describe={(m: Muscle) => `${MUSCLE_LABEL[m]}: ${d.muscles[m] ?? 0} sets this week`} scaleLow="0" scaleHigh={`${FULL_WEEK_SETS}+ sets`} />
        : <MuscleMap values={fatigue} tint="burn" describe={(m: Muscle) => `${MUSCLE_LABEL[m]}: about ${Math.round(d.recovery[m] * 100)}% recovered`} scaleLow="Fresh" scaleHigh="Worked" />}
      {mode === "recovery" && <p className="mt-2 text-xs text-muted">A rough estimate from your recent sets. Trust how you feel over this.</p>}
    </Panel>
  );
}

export default function TrainPage() {
  const router = useRouter();
  const today = useToday();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState(false);

  const load = useCallback(() => {
    if (today) api.get<Overview>(`/api/train/overview?date=${today}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [today]);
  useEffect(load, [load]);

  async function start(body: Record<string, unknown>) {
    try {
      const { id } = await api.post<{ id: number }>("/api/train/workouts", { date: today, ...body });
      router.push(`/train/session/${id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!data) return error ? <ErrorNote message={error} /> : <Loading />;

  return (
    <div className="rise space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow">{dateLong(data.date)}</p>
          <h1 className="display mt-1 text-5xl">Train</h1>
        </div>
        {data.streakWeeks >= 2 && <p className="text-right text-xs text-muted"><span className="display tabular block text-3xl text-accent">{data.streakWeeks}</span>week streak</p>}
      </header>

      <WeekStrip data={data} today={today} />
      <ErrorNote message={error} />

      {data.active ? (
        <Link href={`/train/session/${data.active.id}`} className="knurl block rounded-xl bg-accent p-5 text-on-accent">
          <span className="text-xs font-semibold uppercase tracking-widest">In progress</span>
          <span className="display mt-1 block text-4xl">Resume {data.active.name || "workout"}</span>
        </Link>
      ) : (
        <div className="space-y-2">
          <button onClick={() => start({})} className="knurl display block w-full rounded-xl bg-accent px-5 py-6 text-left text-4xl text-on-accent transition active:scale-[0.99]">Start workout</button>
          <button onClick={() => setPast(true)} className="w-full rounded-lg py-2 text-sm text-muted">Log a past workout</button>
        </div>
      )}

      <Panel title="Say it instead">
        <VoiceBox date={today} workoutId={data.active?.id} onDone={(r) => { if (r.workoutId) router.push(`/train/session/${r.workoutId}`); }} />
      </Panel>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="eyebrow">Routines</h2><Link href="/train/routines/new" className="text-xs text-accent">New routine</Link></div>
        {data.routines.length > 0
          ? <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{data.routines.map((r) => <RoutineTile key={r.id} r={r} onStart={(routineId) => start({ routineId })} />)}</div>
          : <p className="text-sm text-muted">Save a workout as a routine to start it in one tap.</p>}
      </section>

      {data.insights.length > 0 && (
        <Panel title="Insights" action={<Link href="/train/insights" className="text-xs text-accent">All analytics</Link>}><InsightList insights={data.insights.slice(0, 3)} /></Panel>
      )}

      <WeekPanel d={data} />
      <BodyPanel d={data} />

      <Panel title="Recent" action={<Link href="/train/insights?view=lifts" className="text-xs text-accent">Exercises</Link>}>
        {data.recent.length === 0 ? <Empty title="No workouts yet">Your finished sessions will appear here.</Empty> : (
          <ul className="-my-2 divide-y divide-line">
            {data.recent.map((w) => (
              <li key={w.id}>
                <Link href={`/train/workout/${w.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{w.name}</span>
                    <span className="text-xs text-muted">{dateShort(w.date)} · {fmtMinutes(w.durationMin)}</span></span>
                  <span className="tabular shrink-0 text-sm text-muted">{Math.round(w.kcal ?? 0)} kcal</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <PastSheet open={past} today={today} onClose={() => setPast(false)} onStart={(date) => { setPast(false); void start({ date, retro: true }); }} />
    </div>
  );
}
