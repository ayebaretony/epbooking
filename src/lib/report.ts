// What goes into a report for a chosen period (a year and a range of months). Pure, so it can be tested and reused by both
// the PDF and the Excel export. Uses the same rules as the Dashboard: cancelled bookings count for nothing, revenue counts
// confirmed bookings (no status = confirmed).
import type { Booking } from "../types/models.ts";
import { MONTH_NAMES } from "./months.ts";
import { isRevenueBooking, revenueByMonth, topRepeatClients, utilisation, yearSummary, type ClientRow, type Utilisation, type YearSummary } from "./dashboard.ts";

export type ReportPeriod = { year: number; fromMonth: number; toMonth: number }; // months are 0-11, both included

export type ReportMonth = { month: number; name: string; revenue: number; bookings: number };
export type ReportPitch = { pitch: string; bookings: number; hours: number; revenue: number };

export type ReportData = {
  period: ReportPeriod;
  label: string; // "January – May 2026"
  summary: YearSummary;
  months: ReportMonth[];
  pitches: ReportPitch[];
  busiestPitch: string | null; // the pitch with the most bookings
  clients: ClientRow[];
  utilisation: Utilisation;
  bookings: Booking[]; // every booking in the period (not cancelled), oldest first
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

// "January 2026" for one month, "January – May 2026" for a range
export function periodLabel({ year, fromMonth, toMonth }: ReportPeriod): string {
  return fromMonth === toMonth ? `${MONTH_NAMES[fromMonth]} ${year}` : `${MONTH_NAMES[fromMonth]} – ${MONTH_NAMES[toMonth]} ${year}`;
}

// The first and last date (inclusive) a period covers, as "YYYY-MM-DD", for a bounded database read
export function periodDates({ year, fromMonth, toMonth }: ReportPeriod): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, toMonth + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${year}-${pad(fromMonth + 1)}-01`, to: `${year}-${pad(toMonth + 1)}-${pad(lastDay)}` };
}

export function buildReport(allBookings: readonly Booking[], period: ReportPeriod, pitchNames: readonly string[]): ReportData {
  const { year, fromMonth, toMonth } = period;
  // Only bookings inside the chosen months, and never cancelled ones
  const inPeriod = allBookings.filter((b) => b.date.startsWith(`${year}-`) && monthOf(b.date) >= fromMonth && monthOf(b.date) <= toMonth && b.status !== "cancelled");

  const monthlyRevenue = revenueByMonth(inPeriod, year);
  const months: ReportMonth[] = [];
  for (let month = fromMonth; month <= toMonth; month++) {
    months.push({ month, name: MONTH_NAMES[month], revenue: monthlyRevenue[month], bookings: inPeriod.filter((b) => monthOf(b.date) === month).length });
  }

  const names = [...new Set([...pitchNames, ...inPeriod.map((b) => b.pitch)])];
  const pitches: ReportPitch[] = names
    .map((pitch) => {
      const own = inPeriod.filter((b) => b.pitch === pitch);
      return {
        pitch,
        bookings: own.length,
        hours: round2(own.reduce((sum, b) => sum + b.hours, 0)),
        revenue: round2(own.filter(isRevenueBooking).reduce((sum, b) => sum + b.totalPayment, 0)),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings || a.pitch.localeCompare(b.pitch));

  const busiest = [...pitches].sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue || a.pitch.localeCompare(b.pitch))[0];

  return {
    period,
    label: periodLabel(period),
    summary: yearSummary(inPeriod, year),
    months,
    pitches,
    busiestPitch: busiest && busiest.bookings > 0 ? busiest.pitch : null,
    clients: topRepeatClients(inPeriod, year, 10),
    utilisation: utilisation(inPeriod, year),
    bookings: [...inPeriod].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
  };
}
