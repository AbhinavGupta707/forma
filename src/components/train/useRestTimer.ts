"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "forma-train-rest";
const TICK_MS = 250;

interface Rest {
  endsAt: number;
  total: number;
}

function read(): Rest | null {
  try {
    const raw = localStorage.getItem(KEY);
    const r = raw ? (JSON.parse(raw) as Rest) : null;
    return r && r.endsAt > Date.now() ? r : null;
  } catch {
    return null;
  }
}

function write(r: Rest | null): void {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    // A rest timer that doesn't survive a reload is fine.
  }
}

function chime(ctx: AudioContext | null): void {
  navigator.vibrate?.([200, 100, 200]);
  if (!ctx) return;
  [0, 0.18].forEach((at) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + 0.16);
  });
}

/** Counts to a fixed end time, so it stays right even if the phone sleeps or the page reloads. */
export function useRestTimer() {
  const [rest, setRest] = useState<Rest | null>(null);
  const [left, setLeft] = useState(0);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Restoring from storage has to wait for the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRest(read());
  }, []);

  useEffect(() => {
    if (!rest) return;
    const tick = () => {
      const remaining = (rest.endsAt - Date.now()) / 1000;
      if (remaining <= 0) {
        chime(audio.current);
        write(null);
        setRest(null);
      } else {
        setLeft(remaining);
      }
    };
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [rest]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    // Browsers only allow sound after a tap, and this always runs from one.
    audio.current ??= typeof AudioContext === "undefined" ? null : new AudioContext();
    void audio.current?.resume();
    const r = { endsAt: Date.now() + seconds * 1000, total: seconds };
    write(r);
    setRest(r);
  }, []);

  const adjust = useCallback((seconds: number) => {
    setRest((r) => {
      if (!r) return r;
      const next = { endsAt: r.endsAt + seconds * 1000, total: Math.max(1, r.total + seconds) };
      write(next);
      return next;
    });
  }, []);

  const skip = useCallback(() => {
    write(null);
    setRest(null);
  }, []);

  return { active: rest !== null, left, total: rest?.total ?? 0, start, adjust, skip };
}
