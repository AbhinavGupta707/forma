"use client";
import { useState } from "react";
import type { Recipe } from "@/lib/recipes";
import { api, errorMessage, fmt } from "./client";
import { FoodPicker } from "./FoodPicker";
import { Button, ErrorNote, Sheet } from "./ui";

interface Item {
  foodId: number;
  name: string;
  grams: number;
  kcalPerGram: number;
}

interface Props {
  recipe: Recipe | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RecipeEditor({ recipe, onClose, onSaved }: Props) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [aliases, setAliases] = useState(recipe?.aliases.join(", ") ?? "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 1));
  const [items, setItems] = useState<Item[]>(
    recipe?.items.map((i) => ({ foodId: i.foodId, name: i.foodName, grams: i.grams, kcalPerGram: i.kcalPer100g / 100 })) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalKcal = items.reduce((s, i) => s + i.grams * i.kcalPerGram, 0);

  async function save() {
    setError(null);
    const body = {
      name: name.trim(),
      aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
      servings: Number(servings),
      items: items.map((i) => ({ foodId: i.foodId, grams: i.grams })),
    };
    try {
      if (recipe) await api.put(`/api/recipes/${recipe.id}`, body);
      else await api.post("/api/recipes", body);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove() {
    if (!recipe || !window.confirm(`Delete “${recipe.name}”? Past log entries keep their nutrients.`)) return;
    try {
      await api.del(`/api/recipes/${recipe.id}`);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet open onClose={onClose} title={recipe ? "Edit recipe" : "New recipe"}>
      {picking ? (
        <FoodPicker foodsOnly onPick={(p) => {
          if (p.kind === "food") {
            setItems([...items, { foodId: p.foodId, name: p.label, grams: p.grams, kcalPerGram: p.grams > 0 ? p.kcal / p.grams : 0 }]);
          }
          setPicking(false);
        }} />
      ) : (
        <div className="space-y-3">
          <input placeholder="Name, e.g. Protein shake" value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          <input placeholder="Other names you say (comma separated)" value={aliases} onChange={(e) => setAliases(e.target.value)} className="w-full" />
          <label className="flex items-center gap-2 text-sm text-muted">
            Makes
            <input inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} className="w-16" />
            serving(s)
          </label>
          <ul className="divide-y divide-line">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <input inputMode="decimal" value={it.grams} className="w-20 py-1" aria-label={`${it.name} grams`}
                  onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, grams: Number(e.target.value) || 0 } : x)))} />
                <span className="text-muted">g</span>
                <button onClick={() => setItems(items.filter((_, j) => j !== idx))} className="text-muted" aria-label="Remove">×</button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" className="px-0" onClick={() => setPicking(true)}>+ Add ingredient</Button>
          {items.length > 0 && (
            <p className="tabular text-sm text-muted">≈ {fmt(totalKcal / (Number(servings) || 1))} kcal per serving</p>
          )}
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={!name.trim() || items.length === 0 || !(Number(servings) > 0)}>
              Save
            </Button>
            {recipe && <Button variant="danger" onClick={remove}>Delete</Button>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
