// Turns training and nutrition numbers into a short, ranked list of plain-English observations.
import { VOLUME_BANDS, type MuscleMap } from "./analytics";
import { type Muscle, MUSCLE_LABEL } from "./muscles";

export type Tone = "good" | "warn" | "info";

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  href?: string;
}

export interface LiftTrend {
  movementId: number;
  name: string;
  /** Change in estimated 1RM across the recent window. */
  changePct: number;
  sessions: number;
}

export interface InsightInput {
  sessionsThisWeek: number;
  /** 0 = Monday. */
  weekDayIndex: number;
  muscles: MuscleMap;
  recordsThisWeek: { movementName: string; label: string; movementId: number }[];
  streakWeeks: number;
  cardioMin: number;
  lifts: LiftTrend[];
  protein: { avg: number; target: number; days: number } | null;
  /** Percent change in weekly volume against the recent average. */
  volumeJump: number | null;
  /** True when the calorie goal is below maintenance. */
  cutting: boolean;
}

const MAJOR: Muscle[] = ["chest", "lats", "upper_back", "shoulders", "quads", "hamstrings", "glutes"];
const PUSH: Muscle[] = ["chest", "shoulders", "triceps"];
const PULL: Muscle[] = ["lats", "upper_back", "rear_delts", "biceps"];
const BALANCE_RATIO = 1.5;
const QUAD_HAM_RATIO = 2.5;
const MIN_BALANCE_SETS = 10;
const LATE_IN_WEEK = 4;
const MIN_TREND_SESSIONS = 3;
const STRENGTH_DROP_PCT = -5;
const STRENGTH_HELD_PCT = -2;
const STRENGTH_GAIN_PCT = 2;
const PROTEIN_SHORT = 0.9;
const CARDIO_GUIDELINE_MIN = 150;
const VOLUME_SPIKE_PCT = 30;

const sum = (m: MuscleMap, keys: Muscle[]) => keys.reduce((s, k) => s + (m[k] ?? 0), 0);
const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

function strength(i: InsightInput): Insight[] {
  const tracked = i.lifts.filter((l) => l.sessions >= MIN_TREND_SESSIONS);
  if (tracked.length === 0) return [];
  const down = tracked.filter((l) => l.changePct <= STRENGTH_DROP_PCT);
  if (down.length > 0) {
    const worst = [...down].sort((a, b) => a.changePct - b.changePct)[0];
    return [{
      id: "strength-down", tone: "warn",
      title: `${worst.name} is down ${Math.abs(Math.round(worst.changePct))}%`,
      detail: i.cutting
        ? "Some strength loss is normal in a hard calorie deficit, but a steady drop can mean you're losing muscle. Check your protein and sleep, or ease the deficit."
        : "Check your recovery and sleep, or take an easier week.",
      href: `/train/lifts/${worst.movementId}`,
    }];
  }
  const best = [...tracked].sort((a, b) => b.changePct - a.changePct)[0];
  if (best.changePct >= STRENGTH_GAIN_PCT) {
    return [{
      id: "strength-up", tone: "good", title: `${best.name} is up ${Math.round(best.changePct)}%`,
      detail: i.cutting ? "Getting stronger in a calorie deficit is a great sign that you're keeping muscle." : "Your estimated 1RM is climbing over the last four weeks.",
      href: `/train/lifts/${best.movementId}`,
    }];
  }
  if (i.cutting && tracked.every((l) => l.changePct >= STRENGTH_HELD_PCT)) {
    return [{ id: "strength-held", tone: "good", title: "Strength is holding in your deficit", detail: "Your main lifts are steady, which suggests you're keeping muscle while you lose weight." }];
  }
  return [];
}

function balance(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const push = sum(i.muscles, PUSH);
  const pull = sum(i.muscles, PULL);
  if (push + pull >= MIN_BALANCE_SETS && Math.max(push, pull) / Math.max(Math.min(push, pull), 1) > BALANCE_RATIO) {
    const more = push > pull ? "pushing" : "pulling";
    out.push({
      id: "push-pull", tone: "warn", title: `More ${more} than ${push > pull ? "pulling" : "pushing"} this week`,
      detail: `${Math.round(push)} push sets against ${Math.round(pull)} pull sets. Keeping these closer helps your shoulders and posture.`,
    });
  }
  const quads = i.muscles.quads ?? 0;
  const hams = i.muscles.hamstrings ?? 0;
  if (quads >= VOLUME_BANDS.low && quads / Math.max(hams, 1) > QUAD_HAM_RATIO) {
    out.push({
      id: "quad-ham", tone: "warn", title: "Hamstrings are falling behind quads",
      detail: `${Math.round(quads)} quad sets against ${Math.round(hams)} for hamstrings. Try adding a leg curl or Romanian deadlift.`,
    });
  }
  return out;
}

function volume(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  if (i.weekDayIndex >= LATE_IN_WEEK) {
    const low = MAJOR.filter((m) => (i.muscles[m] ?? 0) < VOLUME_BANDS.low);
    if (low.length > 0 && low.length < MAJOR.length) {
      out.push({
        id: "low-volume", tone: "info", title: `${list(low.slice(0, 3).map((m) => MUSCLE_LABEL[m]))} ${low.length === 1 ? "is" : "are"} light this week`,
        detail: `Under ${VOLUME_BANDS.low} sets so far. Around ${VOLUME_BANDS.target}–${VOLUME_BANDS.high} a week is a common range for building muscle.`,
      });
    }
  }
  const high = (Object.entries(i.muscles) as [Muscle, number][]).filter(([, v]) => v > VOLUME_BANDS.high).map(([m]) => MUSCLE_LABEL[m]);
  if (high.length > 0) {
    out.push({
      id: "high-volume", tone: "warn", title: `${list(high)} above ${VOLUME_BANDS.high} sets`,
      detail: i.cutting ? "Recovery is harder in a calorie deficit, so more sets may not help right now." : "Extra sets beyond this tend to give less back. Watch your recovery.",
    });
  }
  if (i.volumeJump !== null && i.volumeJump >= VOLUME_SPIKE_PCT) {
    out.push({ id: "volume-jump", tone: "warn", title: `Volume is up ${Math.round(i.volumeJump)}% on recent weeks`, detail: "Big jumps are harder to recover from. Build up gradually if you start feeling beaten up." });
  }
  return out;
}

export function buildInsights(i: InsightInput): Insight[] {
  if (i.sessionsThisWeek === 0 && i.lifts.length === 0) return [];
  const out: Insight[] = [];
  if (i.recordsThisWeek.length > 0) {
    const names = [...new Set(i.recordsThisWeek.map((r) => r.movementName))];
    out.push({
      id: "records", tone: "good",
      title: `Records on ${names.length} exercise${names.length === 1 ? "" : "s"} this week`,
      detail: list(names.slice(0, 3)) + (names.length > 3 ? ` and ${names.length - 3} more` : ""),
    });
  }
  out.push(...strength(i));
  if (i.protein && i.protein.avg < i.protein.target * PROTEIN_SHORT) {
    out.push({
      id: "protein", tone: "warn", title: `Protein averaging ${Math.round(i.protein.avg)} g on training days`,
      detail: `Your target is ${Math.round(i.protein.target)} g. In a deficit, protein is what helps you keep muscle.`, href: "/",
    });
  }
  out.push(...balance(i), ...volume(i));
  if (i.cardioMin >= CARDIO_GUIDELINE_MIN) {
    out.push({ id: "cardio", tone: "good", title: `${Math.round(i.cardioMin)} minutes of cardio this week`, detail: `You've passed the ${CARDIO_GUIDELINE_MIN} minutes a week that health guidelines recommend.` });
  }
  if (i.streakWeeks >= 2) {
    out.push({ id: "streak", tone: "good", title: `${i.streakWeeks} weeks in a row`, detail: "You've trained every week. Consistency matters more than any single session." });
  }
  return out;
}
