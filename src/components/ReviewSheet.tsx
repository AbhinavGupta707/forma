"use client";
import { useState } from "react";
import { type Meal, MEALS } from "@/lib/dates";
import type { Proposal, ProposedExercise } from "@/lib/parse/pipeline";
import { api, errorMessage, fmt } from "./client";
import { FoodPicker, type Picked } from "./FoodPicker";
import { Button, ErrorNote, Sheet } from "./ui";

interface Row {
  key: number;
  meal: Meal;
  description: string;
  label: string;
  kind: "food" | "recipe" | "unmatched";
  id: number | null;
  amount: number; // grams for foods, servings for recipes
  kcalPerUnit: number; // per gram or per serving
  basis: string;
  alternatives: { id: number; name: string; kcalPer100g: number }[];
}

function toRows(p: Proposal): Row[] {
  return p.foods.map((f, key) => {
    if (f.recipeId !== null) {
      return { key, meal: f.meal, description: f.description, label: f.label, kind: "recipe", id: f.recipeId,
        amount: f.servings ?? 1, kcalPerUnit: (f.nutrients.kcal ?? 0) / (f.servings || 1), basis: "", alternatives: [] };
    }
    const grams = f.grams ?? 100;
    return { key, meal: f.meal, description: f.description, label: f.label, kind: f.foodId ? "food" : "unmatched",
      id: f.foodId, amount: grams, kcalPerUnit: grams > 0 ? (f.nutrients.kcal ?? 0) / grams : 0,
      basis: f.basis, alternatives: f.alternatives };
  });
}

interface Props {
  proposal: Proposal;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ReviewSheet({ proposal, today, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>(() => toRows(proposal));
  const [exercises, setExercises] = useState<ProposedExercise[]>(proposal.exercises);
  const [replacing, setReplacing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const swap = (row: Row, altId: number) => {
    const alt = row.alternatives.find((a) => a.id === altId);
    if (!alt) return;
    const previous = row.id ? [{ id: row.id, name: row.label, kcalPer100g: row.kcalPerUnit * 100 }] : [];
    update(row.key, { kind: "food", id: alt.id, label: alt.name, kcalPerUnit: alt.kcalPer100g / 100,
      alternatives: [...previous, ...row.alternatives.filter((a) => a.id !== altId)] });
  };

  const replaceWith = (row: Row, p: Picked) => {
    setReplacing(null);
    if (p.kind === "food") update(row.key, { kind: "food", id: p.foodId, label: p.label, amount: p.grams,
      kcalPerUnit: p.grams > 0 ? p.kcal / p.grams : 0, basis: "" });
    if (p.kind === "recipe") update(row.key, { kind: "recipe", id: p.recipeId, label: p.label, amount: p.servings,
      kcalPerUnit: p.kcal / p.servings, basis: "" });
  };

  const unresolved = rows.some((r) => r.kind === "unmatched");
  const total = rows.reduce((s, r) => s + r.amount * r.kcalPerUnit, 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const date = proposal.date;
      if (rows.length > 0) {
        await api.post("/api/entries", rows.map((r) =>
          r.kind === "recipe"
            ? { kind: "recipe", date, meal: r.meal, recipeId: r.id, servings: r.amount }
            : { kind: "food", date, meal: r.meal, foodId: r.id, grams: r.amount }));
      }
      for (const e of exercises) {
        await api.post("/api/exercises", { date, label: e.label, minutes: e.minutes, kcal: e.kcal, activity: e.activity });
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Review">
      {replacing ? (
        <FoodPicker initialQuery={replacing.description} onPick={(p) => replaceWith(replacing, p)} />
      ) : (
        <div className="space-y-3">
          {proposal.date !== today && (
            <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">Logging to <b>{proposal.date}</b></p>
          )}
          {rows.length === 0 && exercises.length === 0 && <p className="text-sm text-muted">Nothing recognised — try rephrasing.</p>}
          {rows.map((r) => (
            <div key={r.key} className={`rounded-xl border p-3 ${r.kind === "unmatched" ? "border-danger" : "border-line"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted">“{r.description}”</div>
                  {r.kind === "unmatched" ? (
                    <div className="text-sm text-danger">No match found</div>
                  ) : r.alternatives.length > 0 ? (
                    <select value={r.id ?? ""} onChange={(e) => swap(r, Number(e.target.value))}
                      className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-medium" aria-label="Matched food">
                      <option value={r.id ?? ""}>{r.label}</option>
                      {r.alternatives.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  ) : (
                    <div className="mt-1 text-sm font-medium">{r.label}{r.kind === "recipe" && " · recipe"}</div>
                  )}
                </div>
                <button onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="text-muted"
                  aria-label="Remove">×</button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input inputMode="decimal" value={r.amount} className="w-20 py-1"
                  onChange={(e) => update(r.key, { amount: Number(e.target.value) || 0 })} aria-label="Amount" />
                <span className="text-sm text-muted">{r.kind === "recipe" ? "serving" : "g"}</span>
                <select value={r.meal} onChange={(e) => update(r.key, { meal: e.target.value as Meal })} className="py-1 text-sm">
                  {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="tabular ml-auto text-sm font-medium">{fmt(r.amount * r.kcalPerUnit)} kcal</span>
              </div>
              {r.basis && r.basis !== "mass" && r.kind === "food" && (
                <div className="mt-1 text-xs text-muted">amount from: {r.basis}</div>
              )}
              <button onClick={() => setReplacing(r)} className="mt-1 text-xs text-accent">Search instead</button>
            </div>
          ))}
          {exercises.map((e, i) => (
            <div key={`ex${i}`} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm">
              <span className="min-w-0 flex-1">🔥 {e.label} · {e.minutes} min</span>
              <input inputMode="numeric" value={e.kcal} className="w-20 py-1" aria-label="Calories burned"
                onChange={(ev) => setExercises(exercises.map((x, j) => (j === i ? { ...x, kcal: Number(ev.target.value) || 0 } : x)))} />
              <span className="text-muted">kcal</span>
              <button onClick={() => setExercises(exercises.filter((_, j) => j !== i))} className="text-muted" aria-label="Remove">×</button>
            </div>
          ))}
          <ErrorNote message={error} />
          <Button className="w-full" onClick={save} disabled={saving || unresolved || (rows.length === 0 && exercises.length === 0)}>
            {saving ? "Saving…" : unresolved ? "Fix or remove unmatched items" : `Add all · ${fmt(total)} kcal`}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
