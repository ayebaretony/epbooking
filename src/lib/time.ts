import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// "Today" and every displayed time use the center timezone (Asia/Dubai), never the browser's (AGENTS.md section 5).
// Calendar days travel as "YYYY-MM-DD" strings, which is also what reservations.date stores.
// Date maths is done in UTC on the calendar parts, so timezones and daylight saving can't shift the result
// (the legacy app got this wrong: it used toISOString() and could move a recurring date by a day).

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseDateString(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

// Minutes since midnight in the center timezone, e.g. 09:30 -> 570
export function minutesOfDay(date: Date, timezone: string): number {
  const [hours, minutes] = formatInTimeZone(date, timezone, "HH:mm").split(":").map(Number);
  return hours * 60 + minutes;
}

// "07:00" -> 420
export function parseHHmm(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

// The real moment (UTC) when a wall-clock time happens at the center: "2026-10-10" + 1080 in Asia/Dubai -> 14:00Z
export function zonedDateTime(date: string, minutes: number, timezone: string): Date {
  return fromZonedTime(`${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`, timezone);
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDateString(date);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return toDateString(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

// Same day-of-month `months` on, or the last day of that month when it is shorter (Jan 31 + 1 month -> Feb 28).
// Always counted from the ORIGINAL date, so a monthly series does not drift (Jan 31, Feb 28, Mar 31 ...).
export function addMonths(date: string, months: number): string {
  const { year, month, day } = parseDateString(date);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return toDateString(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(day, lastDay));
}
