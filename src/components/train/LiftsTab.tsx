"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiftListItem } from "@/lib/train/lifts";
import { MUSCLE_LABEL } from "@/lib/train/muscles";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { Spark } from "./charts";
import { dateShort } from "./format";
import { Empty, Loading, Panel } from "./kit";

export function LiftsTab({ today }: { today: string }) {
  const [lifts, setLifts] = useState<LiftListItem[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<LiftListItem[]>(`/api/train/lifts?today=${today}`).then(setLifts).catch((e) => setError(errorMessage(e)));
  }, [today]);

  if (!lifts) return error ? <ErrorNote message={error} /> : <Loading />;
  if (lifts.length === 0) return <Panel><Empty title="No exercises logged yet">Each exercise you log gets its own progress page here.</Empty></Panel>;
  const shown = lifts.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an exercise" aria-label="Find an exercise" className="w-full" />
      <Panel>
        <ul className="-my-2 divide-y divide-line">
          {shown.map((l) => (
            <li key={l.movementId}>
              <Link href={`/train/lifts/${l.movementId}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{l.name}</span>
                  <span className="block truncate text-xs text-muted">{l.primary === "cardio" ? "Cardio" : MUSCLE_LABEL[l.primary]} · {l.sessions}× · {dateShort(l.lastDate)}</span>
                </span>
                <Spark values={l.spark} />
                <span className="w-16 shrink-0 text-right">
                  {l.bestE1rm !== null && <span className="tabular block text-sm font-medium">{Math.round(l.bestE1rm)} kg</span>}
                  {l.changePct !== null && <span className={`tabular text-xs ${l.changePct >= 0 ? "text-good" : "text-warn"}`}>{l.changePct >= 0 ? "↑" : "↓"} {Math.abs(Math.round(l.changePct))}%</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="text-xs text-muted">Figures are your best estimated one-rep max. Changes compare the last four weeks.</p>
    </div>
  );
}
