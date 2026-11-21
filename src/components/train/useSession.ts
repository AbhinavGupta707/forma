"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MovementContext } from "@/lib/train/history";
import type { Movement } from "@/lib/train/movements";
import { newItem } from "@/lib/train/session-ops";
import type { Workout, WorkoutInput } from "@/lib/train/workouts";
import { api, errorMessage } from "@/components/client";

interface Loaded {
  workout: Workout;
  contexts: Record<number, MovementContext>;
  bodyKg: number;
}

const AUTOSAVE_MS = 500;

const toInput = (w: Workout): WorkoutInput => ({
  name: w.name, notes: w.notes, date: w.date,
  items: w.items.map(({ movement, ...i }) => ({ ...i, movementId: movement.id })),
});

/** Holds the session in memory and autosaves it, so a dropped connection or a closed tab loses almost nothing. */
export function useSession(id: number) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Workout | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const fetchSession = useCallback(() => api.get<Loaded>(`/api/train/workouts/${id}`), [id]);
  const apply = useCallback((d: Loaded) => {
    latest.current = d.workout;
    dirty.current = false;
    setData(d);
  }, []);

  useEffect(() => {
    fetchSession().then(apply).catch((e) => setError(errorMessage(e)));
  }, [fetchSession, apply]);

  const reload = useCallback(() => fetchSession().then(apply), [fetchSession, apply]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (dirty.current && latest.current) {
      dirty.current = false;
      const body = toInput(latest.current);
      // Saves run one at a time so an older one can never land after a newer one.
      chain.current = chain.current.then(() => api.put(`/api/train/workouts/${id}`, body)).catch((e) => {
        dirty.current = true;
        setError(errorMessage(e));
      });
    }
    await chain.current;
  }, [id]);

  const update = useCallback((fn: (w: Workout) => Workout) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next;
    dirty.current = true;
    setData((d) => (d ? { ...d, workout: next } : d));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  const addMovements = useCallback(async (movements: Movement[]) => {
    try {
      const found = await Promise.all(movements.map((m) =>
        api.get<MovementContext>(`/api/train/movements/${m.id}/context?workoutId=${id}`).then((c) => [m.id, c] as const)));
      const contexts = Object.fromEntries(found);
      setData((d) => (d ? { ...d, contexts: { ...d.contexts, ...contexts } } : d));
      update((w) => ({
        ...w,
        items: [...w.items, ...movements.map((m) => {
          const working = contexts[m.id].previous?.sets.filter((s) => s.kind !== "warmup").length ?? null;
          return newItem(m, working);
        })],
      }));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id, update]);

  return { data, error, setError, update, flush, reload, addMovements };
}
