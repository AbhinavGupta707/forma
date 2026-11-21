"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { addDays, localDate, type Meal, MEALS } from "@/lib/dates";
import type { DaySummary, Entry } from "@/lib/log";
import { api, errorMessage, fmt } from "@/components/client";
import { EntrySheet } from "@/components/EntrySheet";
import { FoodPicker, type Picked } from "@/components/FoodPicker";
import { LogBox } from "@/components/LogBox";
import { Card, ErrorNote, MacroBar, Ring, Sheet } from "@/components/ui";

const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };

function dayTitle(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function TodayPage() {
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [day, setDay] = useState<DaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  useEffect(() => {
    // The local date is only known in the browser.
    const t = localDate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    setDate(t);
  }, []);

  const load = useCallback(() => {
    if (!date) return;
    api.get<DaySummary>(`/api/day?date=${date}`).then(setDay).catch((e) => setError(errorMessage(e)));
  }, [date]);
  useEffect(load, [load]);

  async function addPicked(meal: Meal, p: Picked) {
    setAdding(null);
    const body =
      p.kind === "food" ? { kind: "food", date, meal, foodId: p.foodId, grams: p.grams }
      : p.kind === "recipe" ? { kind: "recipe", date, meal, recipeId: p.recipeId, servings: p.servings }
      : { kind: "quick", date, meal, label: p.label, nutrients: p.nutrients };
    try {
      await api.post("/api/entries", [body]);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function copyFromYesterday(meal: Meal) {
    try {
      const { copied } = await api.post<{ copied: number }>("/api/copy-meal", { from: addDays(date, -1), to: date, meal });
      if (copied === 0) setError(`Nothing logged for ${meal} the day before`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function removeExercise(id: number) {
    await api.del(`/api/exercises/${id}`).catch((e) => setError(errorMessage(e)));
    load();
  }

  if (!day) return error
    ? <ErrorNote message={error} />
    : <p role="status" className="text-sm text-muted">Loading your diary…</p>;
  const eaten = day.totals.kcal ?? 0;
  const t = day.targets;
  const addedBack = day.budget > t.kcal;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button onClick={() => setDate(addDays(date, -1))} className="px-2 text-2xl text-muted" aria-label="Previous day">‹</button>
        <h1 className="text-lg font-semibold">{dayTitle(date, today)}</h1>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today}
          className="px-2 text-2xl text-muted disabled:opacity-30" aria-label="Next day">›</button>
      </header>

      {!day.profileSet && (
        <Link href="/settings" className="block rounded-xl bg-accent-soft px-3 py-2 text-sm">
          Set up your profile to get personalised calorie and macro targets →
        </Link>
      )}

      <Card>
        <div className="flex items-center gap-4">
          <Ring value={eaten} max={day.budget}>
            <span className={`tabular text-3xl font-semibold ${day.remaining < 0 ? "text-danger" : ""}`}>
              {fmt(Math.abs(day.remaining))}
            </span>
            <span className="text-xs text-muted">{day.remaining < 0 ? "over" : "remaining"}</span>
          </Ring>
          <dl className="tabular grid flex-1 grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Goal</dt><dd>{fmt(t.kcal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Food</dt><dd>− {fmt(eaten)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-muted">{addedBack || day.exerciseKcal === 0 ? "Exercise" : "Burned (not added)"}</dt>
              <dd className="text-burn">{addedBack ? "+ " : ""}{fmt(day.exerciseKcal)}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 space-y-3">
          <MacroBar label="Protein" value={day.totals.protein ?? 0} target={t.protein} unit="g" color="var(--protein)" />
          <MacroBar label="Carbs" value={day.totals.carbs ?? 0} target={t.carbs} unit="g" color="var(--carbs)" />
          <MacroBar label="Fat" value={day.totals.fat ?? 0} target={t.fat} unit="g" color="var(--fat)" />
        </div>
        <Link href={`/nutrients?date=${date}`} className="mt-3 block text-sm text-accent">
          Fiber, sugar, vitamins & minerals →
        </Link>
      </Card>

      <LogBox date={date} today={today} onSaved={load} />
      <ErrorNote message={error} />

      {MEALS.map((meal) => {
        const entries = day.meals[meal];
        const kcal = entries.reduce((s, e) => s + (e.nutrients.kcal ?? 0), 0);
        return (
          <Card key={meal} className="!p-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <h2 className="font-semibold">{MEAL_LABEL[meal]}</h2>
              <span className="tabular text-sm text-muted">{fmt(kcal)} kcal</span>
            </div>
            <ul className="divide-y divide-line px-4">
              {entries.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setEditing(e)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{e.label}</span>
                      <span className="text-xs text-muted">
                        {e.grams !== null ? `${fmt(e.grams)} g` : e.servings !== null ? `${fmt(e.servings, 2)} serving` : "quick add"}
                        {" · "}P {fmt(e.nutrients.protein)} C {fmt(e.nutrients.carbs)} F {fmt(e.nutrients.fat)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm">{fmt(e.nutrients.kcal)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-4 px-4 pb-3 pt-1 text-sm">
              <button onClick={() => setAdding(meal)} className="font-medium text-accent">+ Add food</button>
              {entries.length === 0 && (
                <button onClick={() => copyFromYesterday(meal)} className="text-muted">Copy previous day</button>
              )}
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Exercise</h2>
          <span className="tabular text-sm text-burn">{fmt(day.exerciseKcal)} kcal</span>
        </div>
        {day.exercises.length === 0 && <p className="mt-1 text-sm text-muted">Say “walked 40 minutes” in the box above, or <Link href="/train" className="text-accent">log a workout</Link>.</p>}
        <ul className="divide-y divide-line">
          {day.exercises.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2 text-sm">
              {x.workoutId !== null
                ? <Link href={`/train/workout/${x.workoutId}`} className="text-accent">{x.label}{x.minutes ? ` · ${fmt(x.minutes)} min` : ""}</Link>
                : <span>{x.label}{x.minutes ? ` · ${fmt(x.minutes)} min` : ""}</span>}
              <span className="flex items-center gap-3">
                <span className="tabular">{fmt(x.kcal)}</span>
                <button onClick={() => removeExercise(x.id)} className="text-muted" aria-label={`Delete ${x.label}`}>×</button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Sheet open={adding !== null} onClose={() => setAdding(null)} title={`Add to ${adding ? MEAL_LABEL[adding] : ""}`}>
        {adding && <FoodPicker onPick={(p) => addPicked(adding, p)} />}
      </Sheet>
      {editing && <EntrySheet entry={editing} onClose={() => setEditing(null)} onChanged={() => { setEditing(null); load(); }} />}
    </div>
  );
}
