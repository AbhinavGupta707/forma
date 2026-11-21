"use client";
import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/recipes";
import { api, errorMessage, fmt } from "@/components/client";
import { RecipeEditor } from "@/components/RecipeEditor";
import { Button, Card, ErrorNote } from "@/components/ui";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);

  const load = () => api.get<Recipe[]>("/api/recipes").then(setRecipes).catch((e) => setError(errorMessage(e)));
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">My recipes</h1>
        <Button onClick={() => setEditing("new")}>+ New</Button>
      </div>
      <p className="text-sm text-muted">
        Save meals you eat often with your exact ingredients. Then just say “my overnight oats” or “half my protein shake”.
      </p>
      <ErrorNote message={error} />
      {recipes?.length === 0 && <Card><p className="text-sm text-muted">No recipes yet.</p></Card>}
      {recipes?.map((r) => (
        <Card key={r.id}>
          <button className="w-full text-left" onClick={() => setEditing(r)}>
            <div className="flex justify-between">
              <h2 className="font-semibold">{r.name}</h2>
              <span className="tabular text-sm">{fmt(r.perServing.kcal)} kcal</span>
            </div>
            <p className="tabular text-xs text-muted">
              per serving ({fmt(r.servingGrams)} g) · P {fmt(r.perServing.protein)} · C {fmt(r.perServing.carbs)} · F {fmt(r.perServing.fat)}
              {r.aliases.length > 0 && ` · also “${r.aliases.join("”, “")}”`}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{r.items.map((i) => i.foodName).join(" · ")}</p>
          </button>
        </Card>
      ))}
      {editing && (
        <RecipeEditor recipe={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }} />
      )}
    </div>
  );
}
