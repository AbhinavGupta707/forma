"use client";
import { useEffect, useState } from "react";
import { type ActivityLevel, computeTargets, type Profile } from "@/lib/goals";
import type { Prefs } from "@/lib/settings";
import { api, errorMessage, fmt } from "@/components/client";
import { Button, Card, ErrorNote } from "@/components/ui";

const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

const ACTIVITY: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary (desk job, little exercise)" },
  { value: "light", label: "Light (exercise 1–3×/week)" },
  { value: "moderate", label: "Moderate (exercise 3–5×/week)" },
  { value: "active", label: "Active (hard exercise 6–7×/week)" },
  { value: "very_active", label: "Very active (physical job + training)" },
];

const PACE = [-1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5];

interface SettingsData {
  profile: Profile;
  prefs: Prefs;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<SettingsData>("/api/settings").then(setData).catch((e) => setError(errorMessage(e)));
  }, []);

  if (!data) return <ErrorNote message={error} />;
  const { profile: p, prefs } = data;
  const imperial = prefs.units === "imperial";
  const t = computeTargets(p);
  const setP = (patch: Partial<Profile>) => { setSaved(false); setData({ ...data, profile: { ...p, ...patch } }); };
  const setPrefs = (patch: Partial<Prefs>) => { setSaved(false); setData({ ...data, prefs: { ...prefs, ...patch } }); };
  const num = (v: string) => Number(v) || 0;

  async function save() {
    setError(null);
    try {
      setData(await api.put<SettingsData>("/api/settings", data));
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Goals & profile</h1>
      <Card className="space-y-3">
        <div className="flex gap-2 text-sm">
          {(["metric", "imperial"] as const).map((u) => (
            <button key={u} onClick={() => setPrefs({ units: u })}
              className={`rounded-lg px-3 py-1 ${prefs.units === u ? "bg-accent text-white" : "bg-bg"}`}>{u}</button>
          ))}
        </div>
        <Field label="Name">
          <input defaultValue={p.name ?? ""} onChange={(e) => setP({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sex">
            <select value={p.sex} onChange={(e) => setP({ sex: e.target.value as Profile["sex"] })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Age">
            <input inputMode="numeric" value={p.age} onChange={(e) => setP({ age: num(e.target.value) })} />
          </Field>
          <Field label={imperial ? "Height (in)" : "Height (cm)"}>
            <input inputMode="decimal" key={`h${prefs.units}`}
              defaultValue={imperial ? Math.round(p.heightCm / CM_PER_IN) : p.heightCm}
              onChange={(e) => setP({ heightCm: imperial ? num(e.target.value) * CM_PER_IN : num(e.target.value) })} />
          </Field>
          <Field label={imperial ? "Weight (lb)" : "Weight (kg)"}>
            <input inputMode="decimal" key={`w${prefs.units}`}
              defaultValue={imperial ? Math.round(p.weightKg * LB_PER_KG) : p.weightKg}
              onChange={(e) => setP({ weightKg: imperial ? num(e.target.value) / LB_PER_KG : num(e.target.value) })} />
          </Field>
        </div>
        <Field label="Activity level">
          <select value={p.activity} onChange={(e) => setP({ activity: e.target.value as ActivityLevel })}>
            {ACTIVITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Goal pace">
          <select value={p.weeklyChangeKg} onChange={(e) => setP({ weeklyChangeKg: Number(e.target.value) })}>
            {PACE.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? "Maintain weight" : `${v < 0 ? "Lose" : "Gain"} ${imperial ? fmt(Math.abs(v) * LB_PER_KG, 1) + " lb" : Math.abs(v) + " kg"} / week`}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Protein (g per kg)">
            <input inputMode="decimal" defaultValue={p.proteinPerKg} onChange={(e) => setP({ proteinPerKg: num(e.target.value) })} />
          </Field>
          <Field label="Fat (% of calories)">
            <input inputMode="numeric" defaultValue={p.fatPct} onChange={(e) => setP({ fatPct: num(e.target.value) })} />
          </Field>
        </div>
        <Field label="Fixed calorie goal (optional, overrides the calculation)">
          <input inputMode="numeric" defaultValue={p.kcalOverride ?? ""} placeholder="e.g. 2200"
            onChange={(e) => setP({ kcalOverride: e.target.value ? num(e.target.value) : undefined })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={prefs.addExerciseBack} onChange={(e) => setPrefs({ addExerciseBack: e.target.checked })} />
          Add exercise calories back to my daily budget
        </label>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Your daily targets</h2>
        <dl className="tabular grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">BMR</dt><dd className="text-right">{fmt(t.bmr)} kcal</dd>
          <dt className="text-muted">Maintenance (TDEE)</dt><dd className="text-right">{fmt(t.tdee)} kcal</dd>
          <dt className="font-medium">Calorie goal</dt><dd className="text-right font-medium">{fmt(t.kcal)} kcal</dd>
          <dt className="text-protein">Protein</dt><dd className="text-right">{t.protein} g</dd>
          <dt className="text-carbs">Carbs</dt><dd className="text-right">{t.carbs} g</dd>
          <dt className="text-fat">Fat</dt><dd className="text-right">{t.fat} g</dd>
        </dl>
        <p className="mt-2 text-xs text-muted">Mifflin-St Jeor BMR × activity, adjusted by 7,700 kcal per kg of weekly change.</p>
      </Card>

      <ErrorNote message={error} />
      <Button className="w-full" onClick={save}>{saved ? "Saved ✓" : "Save"}</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted [&>input]:mt-1 [&>input]:w-full [&>select]:mt-1 [&>select]:w-full">
      {label}
      {children}
    </label>
  );
}
