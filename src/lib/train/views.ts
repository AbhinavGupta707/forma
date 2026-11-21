// Composes database reads and pure analytics into the payload each training screen needs.
import type { DB } from "../db";
import { addDays, weekStart } from "../dates";
import { computeTargets } from "../goals";
import { getDay, trends } from "../log";
import { getProfile } from "../settings";
import {
  type HistoryRow, type MuscleMap, muscleSets, recordsTimeline, recovery, type RecordHit, regionSplit, type RegionShare,
  sessionStats, type SessionStats, volumeStatus, type VolumeStatus,
} from "./analytics";
import { currentBodyKg, loadRows } from "./history";
import { buildInsights, type Insight, type LiftTrend } from "./insights";
import { liftTrends } from "./lifts";
import { type Muscle, MUSCLE_LABEL, MUSCLES, type Region } from "./muscles";
import { listRoutines, type Routine } from "./routines";
import { activeWorkout, getWorkout, listWorkouts, type Workout, type WorkoutSummary } from "./workouts";

const WEEK_DAYS = 7;
const RECOVERY_WINDOW_DAYS = 7;
const VOLUME_BASELINE_WEEKS = 4;
const MIN_BASELINE_WEEKS = 2;

export interface DayCell {
  date: string;
  sessions: { id: number; name: string }[];
  sets: number;
  volume: number;
  cardioMin: number;
}

export interface WeekStats extends SessionStats {
  sessions: number;
  durationMin: number;
  kcal: number;
}

function weekStats(db: DB, rows: HistoryRow[], start: string, bodyKg: number): WeekStats {
  const workouts = listWorkouts(db, start, addDays(start, WEEK_DAYS - 1));
  return {
    ...sessionStats(rows, bodyKg),
    sessions: workouts.length,
    durationMin: workouts.reduce((s, w) => s + (w.durationMin ?? 0), 0),
    kcal: workouts.reduce((s, w) => s + (w.kcal ?? 0), 0),
  };
}

function dayCells(db: DB, rows: HistoryRow[], start: string, bodyKg: number): DayCell[] {
  return Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = addDays(start, i);
    const stats = sessionStats(rows.filter((r) => r.date === date), bodyKg);
    return {
      date, sets: stats.sets, volume: stats.volume, cardioMin: stats.cardioMin,
      sessions: listWorkouts(db, date, date).map((w) => ({ id: w.id, name: w.name })),
    };
  });
}

/** Consecutive weeks with a session, counting back from this week (or last, if this week is still empty). */
export function streakWeeks(db: DB, date: string): number {
  let start = weekStart(date);
  const has = (s: string) => listWorkouts(db, s, addDays(s, WEEK_DAYS - 1)).length > 0;
  if (!has(start)) start = addDays(start, -WEEK_DAYS);
  let n = 0;
  while (has(start)) {
    n += 1;
    start = addDays(start, -WEEK_DAYS);
  }
  return n;
}

export interface NutritionSplit {
  days: number;
  avgKcal: number;
  avgProtein: number;
}

function nutritionSplit(db: DB, start: string, end: string, trained: Set<string>): { training: NutritionSplit; rest: NutritionSplit } {
  const logged = trends(db, start, end).filter((d) => d.kcal > 0);
  const summarise = (days: typeof logged): NutritionSplit => ({
    days: days.length,
    avgKcal: days.length ? days.reduce((s, d) => s + d.kcal, 0) / days.length : 0,
    avgProtein: days.length ? days.reduce((s, d) => s + d.protein, 0) / days.length : 0,
  });
  return { training: summarise(logged.filter((d) => trained.has(d.date))), rest: summarise(logged.filter((d) => !trained.has(d.date))) };
}

function volumeJump(db: DB, start: string, thisWeek: number, bodyKg: number): number | null {
  const weeks = Array.from({ length: VOLUME_BASELINE_WEEKS }, (_, i) => addDays(start, -WEEK_DAYS * (i + 1)))
    .map((s) => sessionStats(loadRows(db, { from: s, to: addDays(s, WEEK_DAYS - 1) }), bodyKg).volume)
    .filter((v) => v > 0);
  if (weeks.length < MIN_BASELINE_WEEKS || thisWeek === 0) return null;
  const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  return ((thisWeek - avg) / avg) * 100;
}

function insightsFor(db: DB, start: string, today: string, rows: HistoryRow[], records: RecordHit[], lifts: LiftTrend[]): Insight[] {
  const profile = getProfile(db);
  const bodyKg = currentBodyKg(db);
  const end = addDays(start, WEEK_DAYS - 1);
  const stats = weekStats(db, rows, start, bodyKg);
  const trained = new Set(rows.map((r) => r.date));
  const { training } = nutritionSplit(db, start, end, trained);
  const targets = computeTargets(profile);
  return buildInsights({
    sessionsThisWeek: stats.sessions,
    weekDayIndex: today > end ? WEEK_DAYS - 1 : Math.max(0, Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000)),
    muscles: muscleSets(rows),
    recordsThisWeek: records.filter((r) => r.type === "weight" || r.type === "e1rm" || r.type === "reps"),
    streakWeeks: streakWeeks(db, today),
    cardioMin: stats.cardioMin,
    lifts,
    protein: training.days > 0 ? { avg: training.avgProtein, target: targets.protein, days: training.days } : null,
    volumeJump: volumeJump(db, start, stats.volume, bodyKg),
    cutting: targets.kcal < targets.tdee,
  });
}

function currentRecovery(db: DB, date: string, nowMs: number): Record<Muscle, number> {
  return recovery(loadRows(db, { from: addDays(date, -RECOVERY_WINDOW_DAYS), to: date }), nowMs);
}

export interface Overview {
  date: string;
  active: ReturnType<typeof activeWorkout>;
  days: DayCell[];
  week: WeekStats;
  lastWeek: WeekStats;
  muscles: MuscleMap;
  recovery: Record<Muscle, number>;
  routines: Routine[];
  recent: WorkoutSummary[];
  insights: Insight[];
  streakWeeks: number;
}

const RECENT_LOOKBACK_DAYS = 365;
const RECENT_LIMIT = 5;

export function overview(db: DB, date: string, nowMs: number): Overview {
  const bodyKg = currentBodyKg(db);
  const start = weekStart(date);
  const rows = loadRows(db, { from: start, to: addDays(start, WEEK_DAYS - 1) });
  const prevStart = addDays(start, -WEEK_DAYS);
  const prevRows = loadRows(db, { from: prevStart, to: addDays(prevStart, WEEK_DAYS - 1) });
  const records = recordsTimeline(loadRows(db), bodyKg).filter((r) => r.date >= start);
  return {
    date,
    active: activeWorkout(db),
    days: dayCells(db, rows, start, bodyKg),
    week: weekStats(db, rows, start, bodyKg),
    lastWeek: weekStats(db, prevRows, prevStart, bodyKg),
    muscles: muscleSets(rows),
    recovery: currentRecovery(db, date, nowMs),
    routines: listRoutines(db),
    recent: listWorkouts(db, addDays(date, -RECENT_LOOKBACK_DAYS), date).slice(0, RECENT_LIMIT),
    insights: insightsFor(db, start, date, rows, records, liftTrends(db, date)),
    streakWeeks: streakWeeks(db, date),
  };
}

export interface MuscleRow {
  muscle: Muscle;
  label: string;
  sets: number;
  status: VolumeStatus;
}

const muscleRows = (m: MuscleMap): MuscleRow[] =>
  MUSCLES.map((x) => ({ muscle: x.key, label: MUSCLE_LABEL[x.key], sets: m[x.key] ?? 0, status: volumeStatus(m[x.key] ?? 0) }))
    .sort((a, b) => b.sets - a.sets);

export interface WeekView {
  start: string;
  end: string;
  stats: WeekStats;
  previous: WeekStats;
  days: DayCell[];
  muscles: MuscleRow[];
  muscleMap: MuscleMap;
  regions: RegionShare[];
  records: RecordHit[];
  nutrition: { training: NutritionSplit; rest: NutritionSplit; targetProtein: number; targetKcal: number };
  insights: Insight[];
}

export function weekView(db: DB, start: string, today: string): WeekView {
  const bodyKg = currentBodyKg(db);
  const end = addDays(start, WEEK_DAYS - 1);
  const prevStart = addDays(start, -WEEK_DAYS);
  const rows = loadRows(db, { from: start, to: end });
  const prev = loadRows(db, { from: prevStart, to: addDays(prevStart, WEEK_DAYS - 1) });
  const muscleMap = muscleSets(rows);
  const records = recordsTimeline(loadRows(db), bodyKg).filter((r) => r.date >= start && r.date <= end);
  const targets = computeTargets(getProfile(db));
  return {
    start, end,
    stats: weekStats(db, rows, start, bodyKg),
    previous: weekStats(db, prev, prevStart, bodyKg),
    days: dayCells(db, rows, start, bodyKg),
    muscles: muscleRows(muscleMap),
    muscleMap,
    regions: regionSplit(muscleMap),
    records,
    nutrition: { ...nutritionSplit(db, start, end, new Set(rows.map((r) => r.date))), targetProtein: targets.protein, targetKcal: targets.kcal },
    insights: insightsFor(db, start, today, rows, records, liftTrends(db, end < today ? end : today)),
  };
}

export interface DayWorkout extends Workout {
  stats: SessionStats;
  records: RecordHit[];
  muscles: MuscleMap;
}

/** One finished session with its stats and records, for the summary screen. */
export function workoutSummary(db: DB, id: number): DayWorkout {
  const bodyKg = currentBodyKg(db);
  const workout = getWorkout(db, id);
  const movementIds = workout.items.map((i) => i.movement.id);
  const rows = loadRows(db, { movementIds });
  const own = rows.filter((r) => r.workoutId === id);
  return {
    ...workout, stats: sessionStats(own, bodyKg), muscles: muscleSets(own),
    records: recordsTimeline(rows, bodyKg).filter((r) => r.workoutId === id),
  };
}

export interface DayView {
  date: string;
  workouts: DayWorkout[];
  other: { label: string; minutes: number | null; kcal: number }[];
  muscleMap: MuscleMap;
  nutrition: { kcal: number; protein: number; budget: number; targetProtein: number };
  burned: number;
}

export function dayView(db: DB, date: string): DayView {
  const rows = loadRows(db, { from: date, to: date });
  const day = getDay(db, date);
  return {
    date,
    workouts: listWorkouts(db, date, date).reverse().map((w) => workoutSummary(db, w.id)),
    other: day.exercises.filter((e) => e.workoutId === null).map((e) => ({ label: e.label, minutes: e.minutes, kcal: e.kcal })),
    muscleMap: muscleSets(rows),
    nutrition: { kcal: day.totals.kcal ?? 0, protein: day.totals.protein ?? 0, budget: day.budget, targetProtein: day.targets.protein },
    burned: day.exerciseKcal,
  };
}

export interface TrendWeek {
  start: string;
  sessions: number;
  sets: number;
  volume: number;
  cardioMin: number;
  regions: Record<Region, number>;
}

export interface CalendarDay {
  date: string;
  /** Sets plus cardio time, as a single effort score for the heat map. */
  load: number;
  sessions: number;
}

export interface CardioSummary {
  name: string;
  movementId: number;
  sessions: number;
  minutes: number;
  km: number;
}

export interface TrendsView {
  weeks: TrendWeek[];
  calendar: CalendarDay[];
  bodyweight: { date: string; kg: number }[];
  records: RecordHit[];
  cardio: CardioSummary[];
  totals: { sessions: number; volume: number; sets: number; cardioMin: number; records: number };
  streakWeeks: number;
}

const CARDIO_MIN_PER_SET = 10;
const RECENT_RECORDS = 8;

function cardioSummary(rows: HistoryRow[]): CardioSummary[] {
  const cardio = rows.filter((r) => r.kind === "cardio");
  return [...new Set(cardio.map((r) => r.movementId))]
    .map((movementId) => {
      const own = cardio.filter((r) => r.movementId === movementId);
      return {
        movementId, name: own[0].movementName, sessions: new Set(own.map((r) => r.workoutId)).size,
        minutes: own.reduce((s, r) => s + (r.set.durationSec ?? 0) / 60, 0),
        km: own.reduce((s, r) => s + (r.set.distanceKm ?? 0), 0),
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
}

export function trendsView(db: DB, weeks: number, today: string): TrendsView {
  const bodyKg = currentBodyKg(db);
  const firstStart = addDays(weekStart(today), -WEEK_DAYS * (weeks - 1));
  const rows = loadRows(db, { from: firstStart, to: today });
  const out: TrendWeek[] = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(firstStart, WEEK_DAYS * i);
    const own = rows.filter((r) => r.date >= start && r.date <= addDays(start, WEEK_DAYS - 1));
    const stats = sessionStats(own, bodyKg);
    return {
      start, sets: stats.sets, volume: stats.volume, cardioMin: stats.cardioMin,
      sessions: new Set(own.map((r) => r.workoutId)).size,
      regions: Object.fromEntries(regionSplit(muscleSets(own)).map((r) => [r.region, r.sets])) as Record<Region, number>,
    };
  });
  const calendar: CalendarDay[] = [];
  for (let d = firstStart; d <= addDays(weekStart(today), WEEK_DAYS - 1); d = addDays(d, 1)) {
    const own = rows.filter((r) => r.date === d);
    const stats = sessionStats(own, bodyKg);
    calendar.push({ date: d, load: stats.sets + stats.cardioMin / CARDIO_MIN_PER_SET, sessions: new Set(own.map((r) => r.workoutId)).size });
  }
  // Heavier, more reps or further: a session can also beat its estimated 1RM, but that's the same achievement.
  const headline = recordsTimeline(loadRows(db), bodyKg).filter((r) => r.date >= firstStart && ["weight", "reps", "distance", "duration"].includes(r.type));
  const totals = sessionStats(rows, bodyKg);
  return {
    weeks: out, calendar,
    bodyweight: trends(db, firstStart, today).flatMap((d) => (d.weightKg === null ? [] : [{ date: d.date, kg: d.weightKg }])),
    records: headline.slice(-RECENT_RECORDS).reverse(),
    cardio: cardioSummary(rows),
    totals: { sessions: new Set(rows.map((r) => r.workoutId)).size, volume: totals.volume, sets: totals.sets, cardioMin: totals.cardioMin, records: headline.length },
    streakWeeks: streakWeeks(db, today),
  };
}
