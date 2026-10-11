// Pure maths for a booking's times and price. Relative .ts imports so `npm test` can run it without a bundler.
import { calcTotalMinor, filsToAed } from "./money.ts";

export const SLOT_MINUTES = 30;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "18:30" -> 1110. null when it is not a valid zero-padded 24-hour time.
export function timeToMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// 1110 -> "18:30"
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Minutes between two times. null when either is invalid or the end is not after the start (nothing runs past midnight).
export function durationMinutes(startTime: string, endTime: string): number | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start === null || end === null || end <= start ? null : end - start;
}

export type Pricing = { durationMinutes: number; hours: number; totalPayment: number };

// What gets stored for a NEW or re-priced booking: hours as a number (90 min -> 1.5) and the total in AED, calculated in
// whole fils so it matches how every existing total was calculated. Totals of existing bookings are never recomputed.
export function priceBooking(rateFils: number, startTime: string, endTime: string): Pricing | null {
  const minutes = durationMinutes(startTime, endTime);
  if (minutes === null) return null;
  return { durationMinutes: minutes, hours: minutes / 60, totalPayment: filsToAed(calcTotalMinor(rateFils, minutes)) };
}

// 2 -> "2", 1.5 -> "1.5", 0.5 -> "0.5"
export function formatHours(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}
