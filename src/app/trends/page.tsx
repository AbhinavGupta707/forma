"use client";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, localDate } from "@/lib/dates";
import type { TrendDay } from "@/lib/log";
import type { Prefs } from "@/lib/settings";
import type { Targets } from "@/lib/goals";
import { api, errorMessage, fmt } from "@/components/client";
import { Button, Card, ErrorNote } from "@/components/ui";

const RANGES = [7, 30, 90] as const;
const LB_PER_KG = 2.20462;

export default function TrendsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [days, setDays] = useState<TrendDay[]>([]);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const to = localDate();
    api.get<TrendDay[]>(`/api/trends?from=${addDays(to, -(range - 1))}&to=${to}`).then(setDays)
      .catch((e) => setError(errorMessage(e)));
    api.get<{ targets: Targets; prefs: Prefs }>("/api/settings")
      .then((s) => { setTargets(s.targets); setPrefs(s.prefs); })
      .catch((e) => setError(errorMessage(e)));
  }, [range]);
  useEffect(load, [load]);

  const imperial = prefs?.units === "imperial";
  const logged = days.filter((d) => d.kcal > 0);
  const avg = (k: "kcal" | "protein" | "carbs" | "fat") =>
    logged.length ? logged.reduce((s, d) => s + d[k], 0) / logged.length : 0;
  const weights = days.filter((d) => d.weightKg !== null)
    .map((d) => ({ date: d.date.slice(5), w: Math.round(d.weightKg! * (imperial ? LB_PER_KG : 1) * 10) / 10 }));
  const chartDays = days.map((d) => ({ ...d, label: d.date.slice(5) }));

  async function saveWeight() {
    const v = Number(weight);
    if (!(v > 0)) return;
    try {
      await api.post("/api/weights", { date: localDate(), kg: imperial ? v / LB_PER_KG : v });
      setWeight("");
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trends</h1>
        <div className="flex gap-1 text-sm">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded-lg px-3 py-1 ${range === r ? "bg-accent text-white" : "bg-card"}`}>{r}d</button>
          ))}
        </div>
      </div>
      <ErrorNote message={error} />

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Calories</h2>
          <span className="tabular text-sm text-muted">avg {fmt(avg("kcal"))} on {logged.length} logged days</span>
        </div>
        <div className="h-48">
          <ResponsiveContainer>
            <BarChart data={chartDays} margin={{ left: -20, right: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }}
                domain={[0, (dataMax: number) => Math.max(dataMax, Math.ceil((targets?.kcal ?? 0) * 1.1))]} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)" }} />
              {targets && <ReferenceLine y={targets.kcal} stroke="var(--accent)" strokeDasharray="4 4" />}
              <Bar dataKey="kcal" name="Eaten" fill="var(--fg)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="exerciseKcal" name="Burned" fill="var(--burn)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Average macros (logged days)</h2>
        <dl className="tabular grid grid-cols-3 text-center">
          {([["protein", "Protein", "text-protein"], ["carbs", "Carbs", "text-carbs"], ["fat", "Fat", "text-fat"]] as const).map(([k, label, cls]) => (
            <div key={k}>
              <dd className={`text-xl font-semibold ${cls}`}>{fmt(avg(k))} g</dd>
              <dt className="text-xs text-muted">{label}{targets ? ` / ${targets[k]}` : ""}</dt>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Weight</h2>
        <div className="mb-3 flex gap-2">
          <input inputMode="decimal" placeholder={`Today's weight (${imperial ? "lb" : "kg"})`} value={weight}
            onChange={(e) => setWeight(e.target.value)} className="min-w-0 flex-1" />
          <Button onClick={saveWeight} disabled={!(Number(weight) > 0)}>Log</Button>
        </div>
        {weights.length < 2 ? (
          <p className="text-sm text-muted">Log your weight on a couple of days to see the trend.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer>
              <LineChart data={weights} margin={{ left: -20, right: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)" }} />
                <Line dataKey="w" name={imperial ? "lb" : "kg"} stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
