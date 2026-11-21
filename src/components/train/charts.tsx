"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VOLUME_BANDS, type RegionShare, type VolumeStatus } from "@/lib/train/analytics";
import { REGIONS } from "@/lib/train/muscles";
import type { CalendarDay, MuscleRow, TrendWeek } from "@/lib/train/views";
import { dateLong, dateShort } from "./format";

const AXIS = { fontSize: 10, fill: "var(--muted)" };
const TIP = {
  contentStyle: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--fg)" },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--panel)", opacity: 0.6 },
};

const compact = (v: number): string => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

interface BarsProps {
  data: object[];
  x: string;
  y: string;
  name: string;
  unit: string;
  height?: number;
  color?: string;
}

/** One series of thin bars. Axis lines stay recessive so the bars carry the reading. */
export function Bars({ data, x, y, name, unit, height = 150, color = "var(--accent)" }: BarsProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 4, top: 6 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
          <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={34} tickCount={4} tickFormatter={compact} />
          <Tooltip {...TIP} formatter={(v) => [`${Math.round(Number(v)).toLocaleString()} ${unit}`, name]} />
          <Bar dataKey={y} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LineProps {
  data: object[];
  x: string;
  y: string;
  name: string;
  unit: string;
  /** Points to ring, such as records. */
  marks?: { x: string; y: number }[];
  height?: number;
  color?: string;
}

export function Trend({ data, x, y, name, unit, marks = [], height = 190, color = "var(--accent)" }: LineProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
          <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={34} domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={compact} />
          <Tooltip {...TIP} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} formatter={(v) => [`${Math.round(Number(v) * 10) / 10} ${unit}`, name]} />
          <Line dataKey={y} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          {marks.map((m) => <ReferenceDot key={m.x} x={m.x} y={m.y} r={6} fill="none" stroke="var(--fg)" strokeWidth={1.5} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-7 w-20" />;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 76 + 2},${24 - ((v - min) / span) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20" aria-hidden>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const STATUS: Record<VolumeStatus, { label: string; cls: string }> = {
  none: { label: "None", cls: "text-muted" },
  low: { label: "Low", cls: "text-warn" },
  base: { label: "Building", cls: "text-muted" },
  target: { label: "In range", cls: "text-good" },
  high: { label: "High", cls: "text-warn" },
};

const SCALE_MAX = 26;
const pct = (n: number) => `${(Math.min(n, SCALE_MAX) / SCALE_MAX) * 100}%`;

/** Weekly sets for each muscle, against the shaded 10–20 range. */
export function MuscleBars({ rows }: { rows: MuscleRow[] }) {
  return (
    <div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.muscle} className="grid grid-cols-[5.25rem_1fr_5.5rem] items-center gap-2 text-xs">
            <span className="truncate">{r.label}</span>
            <span className="relative h-2 rounded-full bg-panel" title={`${r.sets} sets`}>
              <span className="absolute inset-y-0 bg-line" style={{ left: pct(VOLUME_BANDS.target), width: `${((VOLUME_BANDS.high - VOLUME_BANDS.target) / SCALE_MAX) * 100}%` }} />
              <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: pct(r.sets) }} />
            </span>
            <span className="tabular whitespace-nowrap text-right"><span className="font-medium">{r.sets}</span> <span className={STATUS[r.status].cls}>{STATUS[r.status].label}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">The shaded band is {VOLUME_BANDS.target}–{VOLUME_BANDS.high} sets, a common guide for building muscle. Sets that work a muscle indirectly count as half.</p>
    </div>
  );
}

export function RegionBars({ regions }: { regions: RegionShare[] }) {
  return (
    <ul className="space-y-2.5">
      {regions.map((r) => (
        <li key={r.region} className="grid grid-cols-[4.75rem_1fr_3rem] items-center gap-2 text-xs">
          <span>{r.region}</span>
          <span className="h-2 rounded-full bg-panel"><span className="block h-full rounded-full bg-accent" style={{ width: `${r.share * 100}%` }} /></span>
          <span className="tabular text-right font-medium">{Math.round(r.share * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

const heat = (v: number) => (v <= 0 ? "var(--panel)" : `color-mix(in oklab, var(--accent) ${Math.round(20 + v * 80)}%, var(--panel))`);

/** Sets per body part per week, so a neglected area shows up as a dark row. */
export function RegionHeat({ weeks }: { weeks: TrendWeek[] }) {
  const max = Math.max(1, ...weeks.flatMap((w) => REGIONS.map((r) => w.regions[r] ?? 0)));
  const cols = { gridTemplateColumns: `4.5rem repeat(${weeks.length}, minmax(0, 1fr))` };
  return (
    <div>
      <div className="grid gap-[3px]" style={cols}>
        {REGIONS.flatMap((r) => [
          <span key={r} className="self-center text-xs">{r}</span>,
          ...weeks.map((w) => {
            const v = w.regions[r] ?? 0;
            return <span key={r + w.start} className="h-6 rounded-[3px]" style={{ background: heat(v / max) }} title={`${r}, week of ${dateShort(w.start)}: ${v} sets`} />;
          }),
        ])}
      </div>
      <div className="mt-2 flex justify-between pl-[4.75rem] text-[10px] text-muted"><span>{dateShort(weeks[0].start)}</span><span>This week</span></div>
    </div>
  );
}

const LEVEL_MAX = 30;

/** Weeks run left to right, Monday at the top. Tapping a day opens it. */
export function CalendarHeat({ days, today }: { days: CalendarDay[]; today: string }) {
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridAutoColumns: "minmax(0, 1fr)" }}>
        {days.map((d) => d.date > today
          ? <span key={d.date} className="aspect-square" />
          : (
            <Link key={d.date} href={`/train/insights?view=day&date=${d.date}`} aria-label={`${dateLong(d.date)}, ${d.sessions} sessions`} title={`${dateLong(d.date)}: ${d.sessions} session${d.sessions === 1 ? "" : "s"}`}
              className="aspect-square rounded-[3px]" style={{ background: heat(d.sessions > 0 ? Math.max(0.15, Math.min(1, d.load / LEVEL_MAX)) : 0) }} />
          ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
        <span>Rest</span>
        <span className="h-1.5 w-20 rounded-full" style={{ background: "linear-gradient(90deg, var(--panel), var(--accent))" }} />
        <span>Harder session</span>
      </div>
    </div>
  );
}
