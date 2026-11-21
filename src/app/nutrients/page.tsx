import { isIsoDate } from "@/lib/dates";
import { NutrientsView } from "./NutrientsView";

export default async function NutrientsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <NutrientsView date={date && isIsoDate(date) ? date : null} />;
}
