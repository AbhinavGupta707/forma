"use client";
import { useState } from "react";
import type { Proposal } from "@/lib/parse/pipeline";
import { api, errorMessage, nowTime } from "./client";
import { ReviewSheet } from "./ReviewSheet";
import { useSpeech } from "./useSpeech";
import { ErrorNote } from "./ui";

interface Props {
  date: string;
  today: string;
  onSaved: () => void;
}

/** Say or type what you ate/did; the AI turns it into entries you confirm in one tap. */
export function LogBox({ date, today, onSaved }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  async function submit(input: string) {
    const t = input.trim();
    if (t.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      // When viewing a past day, parse as if it's late on that day so meals aren't all "dinner".
      setProposal(await api.post<Proposal>("/api/parse", { text: t, date, time: date === today ? nowTime() : "12:00" }));
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
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void submit(text); }}>
        <textarea
          value={speech.listening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(text); } }}
          placeholder={speech.listening ? "Listening…" : "“2 eggs and toast for breakfast, ran 30 min”"}
          rows={2}
          className="min-w-0 flex-1 resize-none"
          aria-label="What did you eat or do?"
        />
        {speech.supported && (
          <button type="button" onClick={speech.listening ? speech.stop : speech.start}
            aria-label={speech.listening ? "Stop listening" : "Speak"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${speech.listening ? "animate-pulse bg-danger text-white" : "bg-accent-soft text-accent"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" />
            </svg>
          </button>
        )}
        <button type="submit" disabled={busy || text.trim().length < 2}
          className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "…" : "Log"}
        </button>
      </form>
      {busy && <p className="text-xs text-muted">Matching foods…</p>}
      <ErrorNote message={error ?? speech.error} />
      {proposal && (
        <ReviewSheet proposal={proposal} today={date} onClose={() => setProposal(null)}
          onSaved={() => { setProposal(null); setText(""); onSaved(); }} />
      )}
    </div>
  );
}
