"use client";
import { useState } from "react";
import { type Meal, MEALS } from "@/lib/dates";
import type { Entry } from "@/lib/log";
import { NUTRIENTS, percentDv } from "@/lib/nutrients";
import { api, errorMessage, fmt } from "./client";
import { Button, ErrorNote, Sheet } from "./ui";

interface Props {
  entry: Entry;
  onClose: () => void;
  onChanged: () => void;
}

/** Edit amount/meal of a logged entry, delete it, and see its full nutrient breakdown. */
export function EntrySheet({ entry, onClose, onChanged }: Props) {
  const isRecipe = entry.servings !== null;
  const isQuick = entry.grams === null && entry.servings === null;
  const [amount, setAmount] = useState(String(entry.grams ?? entry.servings ?? ""));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const n = Number(amount);
    if (!isQuick && !(n > 0)) return setError("Enter an amount above 0");
    try {
      await api.patch(`/api/entries/${entry.id}`, isQuick ? { meal } : isRecipe ? { servings: n, meal } : { grams: n, meal });
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove() {
    try {
      await api.del(`/api/entries/${entry.id}`);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const rows = NUTRIENTS.filter((d) => entry.nutrients[d.key] !== undefined && d.key !== "kcal");
  return (
    <Sheet open onClose={onClose} title={entry.label}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {!isQuick && (
            <>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24" aria-label="Amount" />
              <span className="text-sm text-muted">{isRecipe ? "servings" : "g"}</span>
            </>
          )}
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} aria-label="Meal">
            {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <ErrorNote message={error} />
        <div className="flex gap-2">
          <Button onClick={save} className="flex-1">Save</Button>
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
        <p className="tabular text-sm"><b>{fmt(entry.nutrients.kcal)} kcal</b> as logged</p>
        <table className="tabular w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((d) => {
              const pct = percentDv(d.key, entry.nutrients[d.key]);
              return (
                <tr key={d.key}>
                  <td className="py-1">{d.label}</td>
                  <td className="py-1 text-right">{fmt(entry.nutrients[d.key], 1)} {d.unit}</td>
                  <td className="w-14 py-1 text-right text-muted">{pct === null ? "" : `${fmt(pct)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
