"use client";
import { useState } from "react";
import { api, errorMessage } from "@/components/client";
import { ErrorNote } from "@/components/ui";
import { useSpeech } from "@/components/useSpeech";

export interface ParseResult {
  workoutId: number | null;
  added: number;
  unmatched: string[];
}

interface Props {
  date: string;
  workoutId?: number;
  /** Runs first, so anything unsaved is on the server before the new sets are added. */
  before?: () => Promise<void>;
  onDone: (r: ParseResult) => void;
}

/** Say or type sets, e.g. "bench 3 sets of 8 at 60, treadmill 30 minutes 400 calories". */
export function VoiceBox({ date, workoutId, before, onDone }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(input: string) {
    const t = input.trim();
    if (t.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await before?.();
      const r = await api.post<ParseResult>("/api/train/parse", { text: t, date, workoutId });
      if (r.added > 0) setText("");
      if (r.unmatched.length > 0) setNote(`Couldn't match: ${r.unmatched.join(", ")}`);
      else if (r.added === 0) setNote("I couldn't find any exercises in that. Try “squat 3 sets of 5 at 100”.");
      onDone(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const speech = useSpeech((spoken) => {
    setText(spoken);
    void submit(spoken);
  });

  return (
    <div className="space-y-2">
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void submit(text); }}>
        <input value={speech.listening ? speech.interim : text} onChange={(e) => setText(e.target.value)}
          placeholder={speech.listening ? "Listening…" : "“Bench 3×8 at 60, treadmill 30 min”"}
          aria-label="Describe your sets" className="min-w-0 flex-1" />
        {speech.supported && (
          <button type="button" onClick={speech.listening ? speech.stop : speech.start} aria-label={speech.listening ? "Stop listening" : "Speak"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${speech.listening ? "animate-pulse bg-danger text-white" : "bg-panel text-accent"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" />
            </svg>
          </button>
        )}
        <button type="submit" disabled={busy || text.trim().length < 2}
          className="h-11 shrink-0 rounded-lg bg-panel px-4 text-sm font-medium text-accent disabled:opacity-40">
          {busy ? "…" : "Add"}
        </button>
      </form>
      {note && <p className="text-xs text-muted">{note}</p>}
      <ErrorNote message={error ?? speech.error} />
    </div>
  );
}
