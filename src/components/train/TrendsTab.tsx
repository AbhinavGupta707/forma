"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TrendsView } from "@/lib/train/views";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { Bars, CalendarHeat, RegionHeat, Trend } from "./charts";
import { dateShort, fmtMinutes, fmtVolume } from "./format";
import { Empty, Loading, Panel, Segment, Stat } from "./kit";

const RANGES = [{ value: 8, label: "8 wk" }, { value: 12, label: "12 wk" }, { value: 26, label: "6 mo" }, { value: 52, label: "1 yr" }];

export function TrendsTab({ today }: { today: string }) {
  const [weeks, setWeeks] = useState(12);
  const [data, setData] = useState<TrendsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<TrendsView>(`/api/train/trends?weeks=${weeks}&today=${today}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [weeks, today]);

  const range = <Segment label="Time range" value={weeks} onChange={setWeeks} options={RANGES} />;
  if (!data) return <div className="space-y-4">{range}<ErrorNote message={error} /><Loading /></div>;
  if (data.totals.sessions === 0) return <div className="space-y-4">{range}<Panel><Empty title="No training in this period">Log a few sessions and your trends will build here.</Empty></Panel></div>;

  const chart = data.weeks.map((w) => ({ ...w, label: dateShort(w.start), volume: Math.round(w.volume), cardioMin: Math.round(w.cardioMin) }));
  const weightChart = data.bodyweight.map((b) => ({ ...b, label: dateShort(b.date) }));

  return (
    <div className="space-y-4">
      {range}
      <Panel>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          <Stat label="Sessions" value={String(data.totals.sessions)} delta={`${(data.totals.sessions / weeks).toFixed(1)} a week`} />
          <Stat label="Volume" value={fmtVolume(data.totals.volume)} />
          <Stat label="Cardio" value={fmtMinutes(data.totals.cardioMin)} />
          <Stat label="Records" value={String(data.totals.records)} delta={data.streakWeeks ? `${data.streakWeeks} week streak` : undefined} />
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Consistency"><CalendarHeat days={data.calendar} today={today} /></Panel>
          <Panel title="Weekly volume"><Bars data={chart} x="label" y="volume" name="Volume" unit="kg" /></Panel>
          <Panel title="Weekly cardio"><Bars data={chart} x="label" y="cardioMin" name="Cardio" unit="min" height={130} color="var(--burn)" /></Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Sets by body part"><RegionHeat weeks={data.weeks} /></Panel>
          {weightChart.length >= 2 && <Panel title="Body weight"><Trend data={weightChart} x="label" y="kg" name="Weight" unit="kg" height={150} color="var(--fg)" /></Panel>}
          {data.records.length > 0 && (
            <Panel title="Latest records">
              <ul className="space-y-1.5 text-sm">
                {data.records.map((r, i) => (
                  <li key={i} className="flex justify-between gap-3"><Link href={`/train/lifts/${r.movementId}`} className="min-w-0 truncate">{r.movementName}</Link>
                    <span className="tabular shrink-0 text-muted"><span className="text-accent">{r.label}</span> · {dateShort(r.date)}</span></li>
                ))}
              </ul>
            </Panel>
          )}
          {data.cardio.length > 0 && (
            <Panel title="Cardio by type">
              <table className="w-full text-sm">
                <thead><tr className="eyebrow"><th className="pb-1 text-left font-semibold">Type</th><th className="pb-1 text-right font-semibold">Time</th><th className="pb-1 text-right font-semibold">Km</th></tr></thead>
                <tbody>{data.cardio.map((c) => (
                  <tr key={c.movementId} className="border-t border-line"><td className="py-1.5"><Link href={`/train/lifts/${c.movementId}`}>{c.name}</Link></td>
                    <td className="tabular text-right">{fmtMinutes(c.minutes)}</td><td className="tabular text-right">{c.km ? Math.round(c.km * 10) / 10 : "–"}</td></tr>
                ))}</tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
