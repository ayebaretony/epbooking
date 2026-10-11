import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// Dates travel as "YYYY-MM-DD" text, so formatting only needs their calendar parts. A local Date built from those parts is
// safe here (no timezone maths is involved).
function localDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// "1 Nov 2026"
export function formatDate(date: string): string {
  return format(localDate(date), "d MMM yyyy");
}

// "Sun, 1 Nov 2026"
export function formatDateWithDay(date: string): string {
  return format(localDate(date), "EEE, d MMM yyyy");
}

// "Sunday, 1 November 2026"
export function formatLongDate(date: string): string {
  return format(localDate(date), "EEEE, d MMMM yyyy");
}

// A real moment (for example when a booking was created) shown in the business's timezone: "11 Oct 2026"
export function formatMoment(moment: Date, timezone: string): string {
  return formatInTimeZone(moment, timezone, "d MMM yyyy");
}

// "Mon"
export function formatWeekdayShort(date: string): string {
  return format(localDate(date), "EEE");
}

// "October 2026"
export function formatMonthYear(date: string): string {
  return format(localDate(date), "MMMM yyyy");
}

// "11 October" (no year, for headings that already say it)
export function formatDayMonth(date: string): string {
  return format(localDate(date), "d MMMM");
}

// The day of the month as a number
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

// "12 – 18 Oct 2026", "28 Sep – 4 Oct 2026", "28 Dec 2026 – 3 Jan 2027"
export function formatWeekRange(first: string, last: string): string {
  const start = localDate(first);
  const end = localDate(last);
  if (start.getFullYear() !== end.getFullYear()) return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
  if (start.getMonth() !== end.getMonth()) return `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
  return `${format(start, "d")} – ${format(end, "d MMM yyyy")}`;
}
