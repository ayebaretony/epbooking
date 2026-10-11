// Pure logic behind the Today and Calendar screens: a pitch's day as bookings and free gaps, the day's numbers, and what is
// next. Times are minutes since midnight in the business's timezone. Relative .ts imports, so `npm test` can run it.
import type { Booking } from "../types/models.ts";
import { SLOT_MINUTES, timeToMinutes } from "./bookingMath.ts";

export type Segment =
  | { kind: "booking"; booking: Booking; start: number; end: number }
  | { kind: "free"; start: number; end: number };

// Cancelled bookings no longer reserve the pitch, so they never appear on a schedule
const isActive = (booking: Booking) => booking.status !== "cancelled";

// One pitch on one day, from opening to closing: its bookings in order, with the free gaps between them. `bookings` should
// already be that pitch's bookings for that day. Overlapping bookings (which the guard prevents) are shortened rather than drawn on top of each other.
export function pitchSegments(bookings: readonly Booking[], open: number, close: number): Segment[] {
  const timed = bookings
    .filter(isActive)
    .map((booking) => ({ booking, start: timeToMinutes(booking.startTime), end: timeToMinutes(booking.endTime) }))
    .filter((entry): entry is { booking: Booking; start: number; end: number } => entry.start !== null && entry.end !== null && entry.end > entry.start)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = open;
  for (const { booking, start, end } of timed) {
    const from = Math.max(start, cursor);
    const to = Math.min(end, close);
    if (to <= from) continue; // entirely outside the day, or hidden behind an earlier overlapping booking
    if (from > cursor) segments.push({ kind: "free", start: cursor, end: from });
    segments.push({ kind: "booking", booking, start: from, end: to });
    cursor = to;
  }
  if (cursor < close) segments.push({ kind: "free", start: cursor, end: close });
  return segments;
}

// How many 30-minute slots are still free, counting only time from `fromMinute` onwards (use the current time for "today")
export function freeSlotCount(segmentsPerPitch: readonly (readonly Segment[])[], fromMinute: number, slotMinutes = SLOT_MINUTES): number {
  const from = Math.ceil(fromMinute / slotMinutes) * slotMinutes;
  let count = 0;
  for (const segments of segmentsPerPitch) {
    for (const segment of segments) {
      if (segment.kind !== "free") continue;
      const start = Math.max(segment.start, from);
      if (segment.end > start) count += Math.floor((segment.end - start) / slotMinutes);
    }
  }
  return count;
}

export type DayStats = { bookings: number; hours: number; revenue: number };

// The day's numbers. Cancelled bookings are left out. Revenue counts confirmed bookings only (a booking with no status is
// confirmed, as every existing booking is); pending ones still count as bookings and hours.
export function dayStats(bookings: readonly Booking[]): DayStats {
  const active = bookings.filter(isActive);
  return {
    bookings: active.length,
    hours: active.reduce((sum, booking) => sum + booking.hours, 0),
    revenue: active.filter((booking) => booking.status === undefined || booking.status === "confirmed").reduce((sum, booking) => sum + booking.totalPayment, 0),
  };
}

// The next booking to start after `nowMinutes` today
export function nextBooking(bookings: readonly Booking[], nowMinutes: number): Booking | null {
  let best: { booking: Booking; start: number } | null = null;
  for (const booking of bookings.filter(isActive)) {
    const start = timeToMinutes(booking.startTime);
    if (start !== null && start > nowMinutes && (best === null || start < best.start)) best = { booking, start };
  }
  return best?.booking ?? null;
}

// "Starts in 1h 20m", "Starts in 45m", "Starts in 2h"
export function formatStartsIn(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Starts in ${[hours > 0 && `${hours}h`, rest > 0 && `${rest}m`].filter(Boolean).join(" ") || "less than a minute"}`;
}

// A free gap's suggested booking: starts where the gap starts, lasts `durationMinutes`, but never runs past the gap
export function suggestedSlot(segment: { start: number; end: number }, durationMinutes: number): { start: number; end: number } {
  return { start: segment.start, end: Math.min(segment.start + durationMinutes, segment.end) };
}
