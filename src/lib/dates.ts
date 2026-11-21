export const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type Meal = (typeof MEALS)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Local calendar date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing this date. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
