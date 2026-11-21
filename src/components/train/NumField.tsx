"use client";
import { useState } from "react";

interface Props {
  value: number | null;
  hint?: number | null;
  label: string;
  onChange: (v: number | null) => void;
  integer?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Keeps the raw text while typing, so "62." doesn't snap back to "62". */
export function NumField({ value, hint, label, onChange, integer, disabled, className = "" }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  return (
    <input
      aria-label={label} inputMode={integer ? "numeric" : "decimal"} value={shown} disabled={disabled}
      placeholder={hint === null || hint === undefined ? "" : String(hint)}
      onFocus={(e) => { setDraft(shown); e.target.select(); }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value.replace(",", ".");
        setDraft(text);
        const n = integer ? parseInt(text, 10) : parseFloat(text);
        onChange(Number.isFinite(n) && n >= 0 ? n : null);
      }}
      className={`field-bare tabular placeholder:text-muted/60 ${className}`}
    />
  );
}
