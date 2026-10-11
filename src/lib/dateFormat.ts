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
