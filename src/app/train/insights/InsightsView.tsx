"use client";
import { useState } from "react";
import { DayTab } from "@/components/train/DayTab";
import { useToday } from "@/components/train/format";
import { BackLink, Loading, Segment } from "@/components/train/kit";
import { LiftsTab } from "@/components/train/LiftsTab";
import { TrendsTab } from "@/components/train/TrendsTab";
import { WeekTab } from "@/components/train/WeekTab";

export type InsightsTab = "day" | "week" | "trends" | "lifts";

const OPTIONS: { value: InsightsTab; label: string }[] = [
  { value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "trends", label: "Trends" }, { value: "lifts", label: "Exercises" },
];

export function InsightsView({ initialTab, initialDate }: { initialTab: InsightsTab; initialDate: string | null }) {
  const today = useToday();
  const [tab, setTab] = useState(initialTab);
  const [date, setDate] = useState(initialDate);
  return (
    <div className="train-wide space-y-4">
      <BackLink href="/train" label="Train" />
      <h1 className="display text-5xl">Analytics</h1>
      <Segment label="Analytics view" value={tab} onChange={setTab} options={OPTIONS} />
      {!today ? <Loading /> : (
        <>
          {tab === "day" && <DayTab date={date ?? today} today={today} onDate={setDate} />}
          {tab === "week" && <WeekTab today={today} />}
          {tab === "trends" && <TrendsTab today={today} />}
          {tab === "lifts" && <LiftsTab today={today} />}
        </>
      )}
    </div>
  );
}
