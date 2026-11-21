"use client";
import { useEffect, useState } from "react";
import type { Food, FoodSource, FoodSummary } from "@/lib/foods";
import type { RecentItem } from "@/lib/log";
import type { Recipe } from "@/lib/recipes";
import { api, errorMessage, fmt } from "./client";
import { Button, ErrorNote } from "./ui";

export type Picked =
  | { kind: "food"; foodId: number; grams: number; label: string; kcal: number }
  | { kind: "recipe"; recipeId: number; servings: number; label: string; kcal: number }
  | { kind: "quick"; label: string; nutrients: Record<string, number> };

interface Props {
  onPick: (p: Picked) => void;
  /** Recipes and quick-add are hidden when picking recipe ingredients. */
  foodsOnly?: boolean;
  initialQuery?: string;
}

const SOURCE_LABEL: Record<FoodSource, string> = { fndds: "USDA", foundation: "USDA lab", sr: "USDA SR", starter: "Sample", custom: "Mine" };

export function FoodPicker({ onPick, foodsOnly = false, initialQuery = "" }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<FoodSummary[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [food, setFood] = useState<Food | null>(null);
  const [quick, setQuick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (foodsOnly) return;
    api.get<Recipe[]>("/api/recipes").then(setRecipes).catch((e) => setError(errorMessage(e)));
    api.get<RecentItem[]>("/api/recent").then(setRecent).catch((e) => setError(errorMessage(e)));
  }, [foodsOnly]);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      api.get<FoodSummary[]>(`/api/foods?q=${encodeURIComponent(q)}`).then(setResults)
        .catch((e) => setError(errorMessage(e)));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const openFood = (id: number) =>
    api.get<Food>(`/api/foods/${id}`).then(setFood).catch((e) => setError(errorMessage(e)));

  if (food) return <PortionStep food={food} onBack={() => setFood(null)} onPick={onPick} />;
  if (quick) return <QuickAdd onPick={onPick} onBack={() => setQuick(false)} />;

  const needle = q.trim().toLowerCase();
  const recipeHits = needle
    ? recipes.filter((r) => [r.name, ...r.aliases].some((n) => n.toLowerCase().includes(needle)))
    : [];

  return (
    <div className="space-y-3">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods…" className="w-full" />
      <ErrorNote message={error} />
      {!needle && !foodsOnly && (
        <>
          <Button variant="ghost" className="px-0" onClick={() => setQuick(true)}>+ Quick add calories</Button>
          {recent.length > 0 && <h3 className="text-xs font-semibold uppercase text-muted">Recent</h3>}
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <Row key={`${r.kind}${r.id}`} title={r.label}
                sub={r.kind === "recipe" ? `${r.servings} serving · ${r.kcal} kcal` : `${fmt(r.grams ?? 0)} g · ${r.kcal} kcal`}
                onClick={() =>
                  r.kind === "recipe"
                    ? onPick({ kind: "recipe", recipeId: r.id, servings: r.servings ?? 1, label: r.label, kcal: r.kcal })
                    : onPick({ kind: "food", foodId: r.id, grams: r.grams ?? 100, label: r.label, kcal: r.kcal })
                } />
            ))}
          </ul>
        </>
      )}
      <ul className="divide-y divide-line">
        {recipeHits.map((r) => (
          <Row key={`r${r.id}`} title={r.name} sub={`Recipe · ${fmt(r.perServing.kcal)} kcal / serving`}
            onClick={() => onPick({ kind: "recipe", recipeId: r.id, servings: 1, label: r.name, kcal: r.perServing.kcal ?? 0 })} />
        ))}
        {needle && results.map((f) => (
          <Row key={f.id} title={f.name} sub={`${SOURCE_LABEL[f.source]} · ${fmt(f.kcalPer100g)} kcal / 100 g`}
            onClick={() => openFood(f.id)} />
        ))}
      </ul>
      {needle && results.length === 0 && recipeHits.length === 0 && <p className="text-sm text-muted">No matches.</p>}
    </div>
  );
}

function Row({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="w-full py-2.5 text-left">
        <div className="text-sm">{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </button>
    </li>
  );
}

function PortionStep({ food, onBack, onPick }: { food: Food; onBack: () => void; onPick: (p: Picked) => void }) {
  const options = [{ label: "g", grams: 1 }, ...food.portions, { label: "oz", grams: 28.35 }];
  const [idx, setIdx] = useState(food.portions.length > 0 ? 1 : 0);
  const [qty, setQty] = useState(food.portions.length > 0 ? "1" : "100");
  const grams = (Number(qty) || 0) * options[idx].grams;
  const per = (k: string) => ((food.nutrients[k] ?? 0) * grams) / 100;
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-sm text-accent">‹ Back</button>
      <h3 className="font-medium">{food.name}</h3>
      <div className="flex gap-2">
        <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="w-24" aria-label="Amount" />
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="min-w-0 flex-1" aria-label="Unit">
          {options.map((o, i) => (
            <option key={i} value={i}>{i === 0 || o.label === "oz" ? o.label : `× ${o.label} (${fmt(o.grams)} g)`}</option>
          ))}
        </select>
      </div>
      <p className="tabular text-sm text-muted">
        {fmt(grams)} g · <b className="text-fg">{fmt(per("kcal"))} kcal</b> · P {fmt(per("protein"))} · C {fmt(per("carbs"))} · F {fmt(per("fat"))}
      </p>
      <Button disabled={grams <= 0} className="w-full"
        onClick={() => onPick({ kind: "food", foodId: food.id, grams: Math.round(grams * 10) / 10, label: food.name, kcal: per("kcal") })}>
        Add
      </Button>
    </div>
  );
}

function QuickAdd({ onPick, onBack }: { onPick: (p: Picked) => void; onBack: () => void }) {
  const [v, setV] = useState({ label: "", kcal: "", protein: "", carbs: "", fat: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const nutrients = Object.fromEntries(
    (["kcal", "protein", "carbs", "fat"] as const).filter((k) => v[k] !== "").map((k) => [k, Number(v[k])]),
  );
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-sm text-accent">‹ Back</button>
      <input placeholder="Name (e.g. Restaurant meal)" value={v.label} onChange={set("label")} className="w-full" />
      <div className="grid grid-cols-4 gap-2">
        {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
          <label key={k} className="text-xs text-muted">
            {k === "kcal" ? "kcal" : `${k} g`}
            <input inputMode="decimal" value={v[k]} onChange={set(k)} className="mt-1 w-full" />
          </label>
        ))}
      </div>
      <Button className="w-full" disabled={!v.kcal || Number.isNaN(Number(v.kcal))}
        onClick={() => onPick({ kind: "quick", label: v.label.trim() || "Quick add", nutrients })}>
        Add
      </Button>
    </div>
  );
}
