"use client";
import { useEffect, useState } from "react";
import { localDate } from "@/lib/dates";

/** The local date, known only in the browser. Empty on the first render. */
export function useToday(): string {
  const [today, setToday] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localDate());
  }, []);
  return today;
}

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const fmtKg = (n: number | null | undefined): string => (n ? `${Math.round(n * 100) / 100}` : "0");

export function fmtVolume(kg: number): string {
  if (kg >= 100_000) return `${Math.round(kg / 1000)}t`;
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg).toLocaleString()} kg`;
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function fmtMinutes(min: number | null): string {
  if (!min) return "–";
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

const asDate = (d: string) => new Date(`${d}T12:00:00`);

export const dayLetter = (d: string): string => asDate(d).toLocaleDateString(undefined, { weekday: "narrow" });
export const dayShort = (d: string): string => asDate(d).toLocaleDateString(undefined, { weekday: "short" });
export const dateShort = (d: string): string => asDate(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
export const dateLong = (d: string): string =>
  asDate(d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
