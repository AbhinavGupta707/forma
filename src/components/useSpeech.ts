"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Browser speech-to-text. `supported` is false on browsers without the API or on
 * non-HTTPS origins other than localhost; the keyboard's dictation button still works there.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    // Feature detection must run after hydration to avoid a server/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getCtor() !== null && window.isSecureContext);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    finalText.current = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim(finalText.current + live);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission denied" : `Speech error: ${e.error}`);
    r.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.current.trim();
      if (text) onFinalRef.current(text);
    };
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, interim, error, start, stop };
}
