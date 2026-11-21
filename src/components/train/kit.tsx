"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Insight } from "@/lib/train/insights";

export function Panel({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface StatProps {
  label: string;
  value: string;
  /** Change against the previous period, shown as a plain figure. */
  delta?: string;
  deltaUp?: boolean | null;
}

export function Stat({ label, value, delta, deltaUp = null }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div className="display tabular mt-1 truncate text-[2rem]">{value}</div>
      {delta && (
        <div className={`mt-1 text-xs ${deltaUp === null ? "text-muted" : deltaUp ? "text-good" : "text-muted"}`}>
          {deltaUp === null ? "" : deltaUp ? "↑ " : "↓ "}{delta}
        </div>
      )}
    </div>
  );
}

export function Segment<T extends string | number>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-lg bg-panel p-0.5 text-sm">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${o.value === value ? "bg-accent text-on-accent" : "text-muted"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TONE: Record<Insight["tone"], { mark: string; cls: string; name: string }> = {
  good: { mark: "↑", cls: "text-good", name: "Good" },
  warn: { mark: "!", cls: "text-warn", name: "Watch" },
  info: { mark: "i", cls: "text-muted", name: "Note" },
};

function InsightBody({ insight }: { insight: Insight }) {
  const t = TONE[insight.tone];
  return (
    <div className="flex gap-3 py-3">
      <span aria-label={t.name} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold ${t.cls}`}>{t.mark}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted">{insight.detail}</p>
      </div>
    </div>
  );
}

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <ul className="-my-3 divide-y divide-line">
      {insights.map((i) => (
        <li key={i.id}>{i.href ? <Link href={i.href} className="block"><InsightBody insight={i} /></Link> : <InsightBody insight={i} />}</li>
      ))}
    </ul>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="text-sm text-muted">‹ {label}</Link>;
}

export function Loading() {
  return <div className="h-40 animate-pulse rounded-xl bg-card" aria-label="Loading" />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{children}</p>}
    </div>
  );
}
