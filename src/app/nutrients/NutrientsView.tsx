"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { localDate, MEALS } from "@/lib/dates";
import type { DaySummary } from "@/lib/log";
import { type NutrientGroup, NUTRIENTS } from "@/lib/nutrients";
import { api, errorMessage, fmt } from "@/components/client";
import { Card, ErrorNote } from "@/components/ui";

const GROUPS: { group: NutrientGroup; title: string }[] = [
  { group: "macro", title: "Macronutrients" },
  { group: "carb", title: "Carbohydrates" },
  { group: "fat", title: "Fats" },
  { group: "vitamin", title: "Vitamins" },
  { group: "mineral", title: "Minerals" },
  { group: "other", title: "Other" },
];

export function NutrientsView({ date: initial }: { date: string | null }) {
  const [day, setDay] = useState<DaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<DaySummary>(`/api/day?date=${initial ?? localDate()}`).then(setDay).catch((e) => setError(errorMessage(e)));
  }, [initial]);

  if (!day) return <ErrorNote message={error} />;
  const entries = MEALS.flatMap((m) => day.meals[m]);
  // Personal macro targets replace the generic FDA values.
  const target = (key: string, dv?: number) =>
    ({ protein: day.targets.protein, carbs: day.targets.carbs, fat: day.targets.fat, kcal: day.targets.kcal })[key] ?? dv;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-2xl text-muted" aria-label="Back">‹</Link>
        <h1 className="text-lg font-semibold">Nutrients · {day.date}</h1>
      </header>
      {entries.length === 0 && <p className="text-sm text-muted">Nothing logged on this day yet.</p>}
      <p className="text-xs text-muted">
        % of daily value (FDA) or your own targets for calories and macros. Bars in red are limits you’ve exceeded. Tap a row to see top sources.
      </p>
      {GROUPS.map(({ group, title }) => (
        <Card key={group}>
          <h2 className="mb-2 font-semibold">{title}</h2>
          <ul className="divide-y divide-line">
            {NUTRIENTS.filter((n) => n.group === group).map((n) => {
              const value = day.totals[n.key] ?? 0;
              const goal = target(n.key, n.dv);
              const pct = goal ? (value / goal) * 100 : null;
              const over = n.limit && pct !== null && pct > 100;
              const sources = entries
                .filter((e) => (e.nutrients[n.key] ?? 0) > 0)
                .sort((a, b) => (b.nutrients[n.key] ?? 0) - (a.nutrients[n.key] ?? 0))
                .slice(0, 4);
              return (
                <li key={n.key} className="py-2">
                  <button className="w-full text-left" onClick={() => setOpen(open === n.key ? null : n.key)}>
                    <div className="tabular flex justify-between text-sm">
                      <span>{n.label}{n.limit && <span className="text-muted"> (limit)</span>}</span>
                      <span>
                        {fmt(value, value < 10 ? 1 : 0)} {n.unit}
                        {goal ? <span className="text-muted"> / {fmt(goal, 1)}</span> : null}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%`, background: over ? "var(--danger)" : "var(--accent)" }} />
                      </div>
                    )}
                  </button>
                  {open === n.key && (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {sources.length === 0 && <li>No sources logged.</li>}
                      {sources.map((e) => (
                        <li key={e.id} className="tabular flex justify-between">
                          <span className="truncate pr-2">{e.label}</span>
                          <span>{fmt(e.nutrients[n.key], 1)} {n.unit}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <p className="text-xs text-muted">
        Source: USDA FoodData Central. Some foods lack data for certain micronutrients, so totals can read low.
      </p>
    </div>
  );
}
