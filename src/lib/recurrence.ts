import { addDays, addMonths } from "./time.ts";

export type RecurrenceType = "none" | "weekly" | "monthly";

export const MIN_OCCURRENCES = 2;
export const MAX_OCCURRENCES = 52;

// The dates of a series, first date included: 4 weekly from Oct 10 -> Oct 10, 17, 24, 31. Monthly series are counted
// from the ORIGINAL date, so they never drift (Jan 31, Feb 28, Mar 31 ...).
export function occurrenceDates(startDate: string, type: RecurrenceType, count: number): string[] {
  if (type === "none") return [startDate];
  const total = Math.min(Math.max(Math.floor(count), 1), MAX_OCCURRENCES);
  return Array.from({ length: total }, (_, index) => (type === "weekly" ? addDays(startDate, index * 7) : addMonths(startDate, index)));
}
