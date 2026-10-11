// The numbers behind the Dashboard. Pure functions over bookings, so they can be tested without a screen.
// Rules (AGENTS.md section 9): cancelled bookings count for nothing; revenue counts CONFIRMED bookings, and a booking with no
// status (every existing booking) is confirmed; amounts are AED numbers, rounded to two decimals to hide floating-point noise.
import type { Booking } from "../types/models.ts";
import { timeToMinutes } from "./bookingMath.ts";
import { dayOfWeekMonday } from "./time.ts";

const isActive = (booking: Booking) => booking.status !== "cancelled";
export const isRevenueBooking = (booking: Booking) => booking.status === undefined || booking.status === "confirmed";
const round2 = (value: number) => Math.round(value * 100) / 100;
const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;
const inYear = (booking: Booking, year: number) => booking.date.startsWith(`${year}-`);

// Revenue for each month of the year, January first
export function revenueByMonth(bookings: readonly Booking[], year: number): number[] {
  const totals = Array<number>(12).fill(0);
  for (const booking of bookings) if (inYear(booking, year) && isRevenueBooking(booking)) totals[monthOf(booking.date)] += booking.totalPayment;
  return totals.map(round2);
}

export type YearSummary = {
  revenue: number;
  bookings: number; // confirmed and pending, not cancelled
  averageBooking: number | null; // revenue per confirmed booking; null when there are none
};

export function yearSummary(bookings: readonly Booking[], year: number): YearSummary {
  const ofYear = bookings.filter((booking) => inYear(booking, year));
  const revenueBookings = ofYear.filter(isRevenueBooking);
  const revenue = round2(revenueBookings.reduce((sum, booking) => sum + booking.totalPayment, 0));
  return {
    revenue,
    bookings: ofYear.filter(isActive).length,
    averageBooking: revenueBookings.length > 0 ? round2(revenue / revenueBookings.length) : null,
  };
}

// The calendar month before `month` (0-11) of `year`, as [year, month]
export function previousMonth(year: number, month: number): [number, number] {
  return month === 0 ? [year - 1, 11] : [year, month - 1];
}

// One month's revenue, looking at any year (so January can be compared with the December before it)
export function monthRevenue(bookings: readonly Booking[], year: number, month: number): number {
  return round2(bookings.filter((b) => inYear(b, year) && monthOf(b.date) === month && isRevenueBooking(b)).reduce((sum, b) => sum + b.totalPayment, 0));
}

// The month (0-11) with the most revenue in the year, or null if the year has none
export function bestMonth(monthly: readonly number[]): { month: number; revenue: number } | null {
  let best: { month: number; revenue: number } | null = null;
  monthly.forEach((revenue, month) => {
    if (revenue > 0 && (best === null || revenue > best.revenue)) best = { month, revenue };
  });
  return best;
}

// The latest month (0-11) of the year that has any booking, or null
export function latestMonthWithBookings(bookings: readonly Booking[], year: number): number | null {
  let latest: number | null = null;
  for (const booking of bookings) if (inYear(booking, year) && isActive(booking)) latest = Math.max(latest ?? 0, monthOf(booking.date));
  return latest;
}

export type PitchRevenue = { pitch: string; revenue: number };

// Revenue per pitch for one month, highest first. Every pitch is listed, even with nothing earned.
export function revenueByPitch(bookings: readonly Booking[], year: number, month: number, pitchNames: readonly string[]): PitchRevenue[] {
  const totals = new Map<string, number>(pitchNames.map((name) => [name, 0]));
  for (const booking of bookings) {
    if (inYear(booking, year) && monthOf(booking.date) === month && isRevenueBooking(booking)) totals.set(booking.pitch, (totals.get(booking.pitch) ?? 0) + booking.totalPayment);
  }
  return [...totals].map(([pitch, revenue]) => ({ pitch, revenue: round2(revenue) })).sort((a, b) => b.revenue - a.revenue || a.pitch.localeCompare(b.pitch));
}

export type ClientRow = { name: string; bookings: number; revenue: number };

// Names are compared ignoring extra spaces and capital letters ("Juventus" and "juventus " are one client). The stored names
// are never changed.
const clientKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// The spelling shown for a client: the one used most often. On a tie, one with capital letters ("Juventus") beats all-lowercase
// ("juventus"), then alphabetical order, so the choice never changes between visits.
function displayName(spellings: ReadonlyMap<string, number>): string {
  const hasCapitals = (name: string) => name !== name.toLowerCase();
  return [...spellings].sort((a, b) => b[1] - a[1] || Number(hasCapitals(b[0])) - Number(hasCapitals(a[0])) || a[0].localeCompare(b[0]))[0][0];
}

// Clients with more than one booking in the year, most bookings first. The name shown is the spelling used most often.
export function topRepeatClients(bookings: readonly Booking[], year: number, limit = 5): ClientRow[] {
  const groups = new Map<string, { spellings: Map<string, number>; bookings: number; revenue: number }>();
  for (const booking of bookings) {
    if (!inYear(booking, year) || !isActive(booking)) continue;
    const key = clientKey(booking.clientName);
    if (!key) continue;
    const group = groups.get(key) ?? { spellings: new Map(), bookings: 0, revenue: 0 };
    const spelling = booking.clientName.trim().replace(/\s+/g, " ");
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
    group.bookings += 1;
    if (isRevenueBooking(booking)) group.revenue += booking.totalPayment;
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.bookings > 1)
    .map((group) => ({ name: displayName(group.spellings), bookings: group.bookings, revenue: round2(group.revenue) }))
    .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type Utilisation = {
  hours: number[]; // the rows: each hour of the day, from the first to the last hour that has any booking
  counts: number[][]; // counts[row][day]: bookings covering that hour on that weekday (Monday = 0)
  max: number;
};

// When the pitches are busy: for every weekday and hour, how many bookings covered any part of that hour. A 2-hour booking
// counts in both of its hours.
export function utilisation(bookings: readonly Booking[], year: number): Utilisation {
  const byHour = new Map<number, number[]>();
  for (const booking of bookings) {
    if (!inYear(booking, year) || !isActive(booking)) continue;
    const start = timeToMinutes(booking.startTime);
    const end = timeToMinutes(booking.endTime);
    if (start === null || end === null || end <= start) continue;
    const day = dayOfWeekMonday(booking.date);
    for (let hour = Math.floor(start / 60); hour * 60 < end; hour++) {
      const row = byHour.get(hour) ?? Array<number>(7).fill(0);
      row[day] += 1;
      byHour.set(hour, row);
    }
  }
  if (byHour.size === 0) return { hours: [], counts: [], max: 0 };
  const first = Math.min(...byHour.keys());
  const last = Math.max(...byHour.keys());
  const hours = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const counts = hours.map((hour) => byHour.get(hour) ?? Array<number>(7).fill(0));
  return { hours, counts, max: Math.max(...counts.flat()) };
}
