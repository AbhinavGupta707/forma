"use client";
import { useEffect, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</section>;
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}

export function Button({ children, onClick, variant = "primary", disabled, type = "button", className = "" }: ButtonProps) {
  const styles = {
    primary: "bg-accent text-on-accent",
    ghost: "bg-transparent text-accent",
    danger: "bg-transparent text-danger",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}>
      {children}
    </button>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title}
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-muted" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  return message ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{message}</p> : null;
}

interface RingProps {
  value: number;
  max: number;
  size?: number;
  children?: ReactNode;
}

export function Ring({ value, max, size = 150, children }: RingProps) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = value > max;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={over ? "var(--danger)" : "var(--accent)"} strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 400ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

interface BarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}

export function MacroBar({ label, value, target, unit, color }: BarProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted">
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 400ms" }} />
      </div>
    </div>
  );
}
