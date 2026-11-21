import { isIsoDate } from "@/lib/dates";
import { InsightsView, type InsightsTab } from "./InsightsView";

const TABS: InsightsTab[] = ["day", "week", "trends", "lifts"];

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const { view, date } = await searchParams;
  return <InsightsView initialTab={TABS.find((t) => t === view) ?? "week"} initialDate={date && isIsoDate(date) ? date : null} />;
}
