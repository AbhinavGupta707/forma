"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addSet, moveItem, patchItem, patchSet, removeItem, removeSet, restAfter, toggleSuperset } from "@/lib/train/session-ops";
import { api, errorMessage } from "@/components/client";
import { Button, ErrorNote, Sheet } from "@/components/ui";
import { ExerciseCard } from "@/components/train/ExerciseCard";
import { ExercisePicker } from "@/components/train/ExercisePicker";
import { FinishSheet } from "@/components/train/FinishSheet";
import { fmtClock, useNow } from "@/components/train/format";
import { Loading } from "@/components/train/kit";
import { RestBar } from "@/components/train/RestBar";
import { useRestTimer } from "@/components/train/useRestTimer";
import { useSession } from "@/components/train/useSession";
import { VoiceBox } from "@/components/train/VoiceBox";

/** Keeps the phone awake during a session, where the browser allows it. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const take = () => {
      if (document.visibilityState === "visible") navigator.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => undefined);
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, []);
}

export default function SessionPage() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const { data, error, setError, update, flush, reload, addMovements } = useSession(id);
  const rest = useRestTimer();
  const now = useNow(1000);
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  useWakeLock();

  if (!data) return <div className="session-root">{error ? <ErrorNote message={error} /> : <Loading />}</div>;
  const { workout: w, contexts, bodyKg } = data;
  const editing = w.status === "done";
  const items = (fn: (i: typeof w.items) => typeof w.items) => update((x) => ({ ...x, items: fn(x.items) }));
  const clock = w.startedAt && !editing ? fmtClock((now - Date.parse(w.startedAt)) / 1000) : null;

  async function discard() {
    try {
      await flush();
      await api.del(`/api/train/workouts/${id}`);
      rest.skip();
      router.replace("/train");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className={`session-root space-y-3 ${rest.active ? "pb-24" : ""}`}>
      <header className="sticky top-0 z-30 -mx-4 -mt-4 flex items-center gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <button onClick={() => void flush().then(() => router.push(editing ? `/train/workout/${id}` : "/train"))} aria-label="Back" className="h-10 w-8 text-2xl text-muted">‹</button>
        <div className="min-w-0 flex-1">
          <input value={w.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} placeholder="Name this workout" aria-label="Workout name"
            className="w-full !border-0 !bg-transparent !p-0 font-semibold placeholder:text-muted" />
          {clock
            ? <div className="tabular text-xs text-accent">{clock}</div>
            : <input type="date" value={w.date} onChange={(e) => e.target.value && update((x) => ({ ...x, date: e.target.value }))} aria-label="Workout date"
                className="!border-0 !bg-transparent !p-0 !text-xs text-muted" />}
        </div>
        <Button onClick={() => setFinishing(true)} disabled={w.items.length === 0}>{editing ? "Save" : "Finish"}</Button>
      </header>

      <ErrorNote message={error} />

      {w.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="display text-3xl">Add your first exercise</p>
          <p className="mt-2 text-sm text-muted">Pick from the library, or say what you did below.</p>
        </div>
      )}

      {w.items.map((item, i) => (
        <ExerciseCard key={`${item.movement.id}-${i}`} item={item} index={i} count={w.items.length} context={contexts[item.movement.id]} bodyKg={bodyKg}
          linkedToNext={item.supersetId !== null && w.items[i + 1]?.supersetId === item.supersetId}
          onSet={(s, patch) => items((list) => patchSet(list, i, s, patch))}
          onCompleted={() => { if (!editing) rest.start(restAfter(w.items, i)); }}
          onAddSet={() => items((list) => addSet(list, i))}
          onRemoveSet={(s) => items((list) => removeSet(list, i, s))}
          onPatch={(patch) => items((list) => patchItem(list, i, patch))}
          onMove={(to) => items((list) => moveItem(list, i, to))}
          onSuperset={() => items((list) => toggleSuperset(list, i))}
          onRemove={() => items((list) => removeItem(list, i))} />
      ))}

      <Button className="w-full !py-3" onClick={() => setPicking(true)}>+ Add exercises</Button>
      <VoiceBox date={w.date} workoutId={id} before={flush} onDone={(r) => { if (r.added > 0) void reload(); }} />
      {!editing && <Button variant="danger" className="w-full" onClick={() => setDiscarding(true)}>Discard workout</Button>}

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onAdd={(m) => void addMovements(m)} />
      {finishing && (
        <FinishSheet open workout={w} bodyKg={bodyKg} nowMs={now} onClose={() => setFinishing(false)} beforeFinish={flush}
          onFinished={() => { rest.skip(); router.replace(`/train/workout/${id}`); }} />
      )}
      <Sheet open={discarding} onClose={() => setDiscarding(false)} title="Discard this workout?">
        <p className="mb-4 text-sm text-muted">Everything logged in this session will be deleted.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setDiscarding(false)}>Keep it</Button>
          <Button className="!bg-danger !text-white" onClick={discard}>Discard</Button>
        </div>
      </Sheet>
      {rest.active && <RestBar left={rest.left} total={rest.total} onAdjust={rest.adjust} onSkip={rest.skip} />}
    </div>
  );
}
