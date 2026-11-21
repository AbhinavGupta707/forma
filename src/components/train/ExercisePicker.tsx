"use client";
import { useEffect, useState } from "react";
import type { MovementKind } from "@/lib/train/catalog";
import type { Movement, MovementHit } from "@/lib/train/movements";
import { MUSCLE_LABEL, MUSCLES, type Target } from "@/lib/train/muscles";
import { api, errorMessage } from "@/components/client";
import { Button, ErrorNote, Sheet } from "@/components/ui";

const FILTERS: { value: Target | ""; label: string }[] = [
  { value: "", label: "All" }, { value: "chest", label: "Chest" }, { value: "lats", label: "Lats" },
  { value: "upper_back", label: "Upper back" }, { value: "shoulders", label: "Shoulders" }, { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" }, { value: "abs", label: "Abs" }, { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" }, { value: "glutes", label: "Glutes" }, { value: "calves", label: "Calves" },
  { value: "cardio", label: "Cardio" },
];

const KINDS: { value: MovementKind; label: string }[] = [
  { value: "load", label: "Weight and reps" }, { value: "bodyweight", label: "Bodyweight reps" },
  { value: "assisted", label: "Assisted" }, { value: "hold", label: "Timed hold" }, { value: "cardio", label: "Cardio" },
];

const targetLabel = (t: Target) => (t === "cardio" ? "Cardio" : MUSCLE_LABEL[t]);

function CreateForm({ name, onCreated }: { name: string; onCreated: (m: Movement) => void }) {
  const [kind, setKind] = useState<MovementKind>("load");
  const [primary, setPrimary] = useState<Target>("chest");
  const [error, setError] = useState<string | null>(null);

  async function create() {
    try {
      onCreated(await api.post<Movement>("/api/train/movements", {
        name, kind, secondary: [],
        equipment: kind === "cardio" ? "cardio" : kind === "load" ? "other" : "bodyweight",
        primary: kind === "cardio" ? "cardio" : primary,
      }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-panel p-3">
      <p className="text-sm font-medium">Create “{name}”</p>
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="How it's logged" value={kind} onChange={(e) => setKind(e.target.value as MovementKind)} className="min-w-0">
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        {kind !== "cardio" && (
          <select aria-label="Main muscle" value={primary} onChange={(e) => setPrimary(e.target.value as Target)} className="min-w-0">
            {MUSCLES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        )}
      </div>
      <ErrorNote message={error} />
      <Button className="w-full" onClick={create}>Create exercise</Button>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (movements: Movement[]) => void;
}

export function ExercisePicker({ open, onClose, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Target | "">("");
  const [hits, setHits] = useState<MovementHit[]>([]);
  const [picked, setPicked] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (muscle) params.set("muscle", muscle);
    const t = setTimeout(() => {
      api.get<MovementHit[]>(`/api/train/movements?${params}`).then(setHits).catch((e) => setError(errorMessage(e)));
    }, 120);
    return () => clearTimeout(t);
  }, [open, q, muscle]);

  const toggle = (m: Movement) =>
    setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : [...p, m]));

  function close() {
    setPicked([]);
    setQ("");
    onClose();
  }

  function finish(list: Movement[]) {
    onAdd(list);
    close();
  }

  return (
    <Sheet open={open} onClose={close} title="Add exercises">
      {/* A fixed height stops the sheet jumping under your finger as results filter. */}
      <div className="flex h-[72vh] flex-col">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. rdl or lat pulldown" aria-label="Search exercises" className="w-full" />
      <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-2">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setMuscle(f.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${muscle === f.value ? "bg-accent text-on-accent" : "bg-panel text-muted"}`}>{f.label}</button>
        ))}
      </div>
      <ErrorNote message={error} />
      {hits.length === 0 && q.trim().length > 1 && <CreateForm name={q.trim()} onCreated={(m) => finish([...picked, m])} />}
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {hits.map((m) => {
          const on = picked.some((x) => x.id === m.id);
          return (
            <li key={m.id}>
              <button onClick={() => toggle(m)} aria-pressed={on} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  <span className="text-xs capitalize text-muted">{[targetLabel(m.primary), m.kind === "cardio" ? null : m.equipment, m.uses > 0 ? `${m.uses}×` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${on ? "bg-accent text-on-accent" : "bg-panel text-muted"}`}>{on ? "✓" : "+"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked.length > 0 && (
        <Button className="mt-2 w-full shrink-0 !py-3" onClick={() => finish(picked)}>Add {picked.length} exercise{picked.length === 1 ? "" : "s"}</Button>
      )}
      </div>
    </Sheet>
  );
}
