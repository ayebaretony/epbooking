// What the app remembers about bookings, and how it finds it again. Names (keys) are shared by the screens and by the
// start-up prefetch, so a request already under way is reused instead of repeated. Relative .ts imports so it is testable.
import { queryCache } from "../../lib/queryCache.ts";
import type { Booking } from "../../types/models.ts";
import { BOOKINGS_CACHE_PREFIX } from "./bookings.service.ts";

// How long a remembered answer is trusted before it is quietly checked again. Short for bookings, because other people
// (or another phone) can change them; longer for things that rarely change.
export const MAX_AGE = { bookings: 20_000, years: 5 * 60_000, pitches: 5 * 60_000 } as const;

export const rangeKey = (from: string, to: string) => `${BOOKINGS_CACHE_PREFIX}${from}:${to}`;
export const yearKey = (year: number) => rangeKey(`${year}-01-01`, `${year}-12-31`);
export const YEARS_KEY = `${BOOKINGS_CACHE_PREFIX}years`;
export const bookingKey = (id: string) => `${BOOKINGS_CACHE_PREFIX}doc:${id}`;

// A range inside one calendar year can be cut out of that year if it is already remembered. Pass maxAgeMs to insist the
// year is recent; leave it out to accept any age (to show something at once while the real answer loads).
export function bookingsFromCachedYear(from: string, to: string, maxAgeMs?: number): Booking[] | undefined {
  if (from.slice(0, 4) !== to.slice(0, 4)) return undefined; // spans two years: no single year covers it
  const key = yearKey(Number(from.slice(0, 4)));
  const year = queryCache.get<Booking[]>(key);
  if (!year) return undefined;
  if (maxAgeMs !== undefined && (queryCache.ageOf(key) ?? Infinity) > maxAgeMs) return undefined;
  return year.filter((booking) => booking.date >= from && booking.date <= to);
}

// A booking that is already inside any remembered list, so its page can open at once
export function findCachedBooking(id: string): Booking | undefined {
  for (const key of queryCache.keysWithPrefix(BOOKINGS_CACHE_PREFIX)) {
    const value = queryCache.get<unknown>(key);
    if (Array.isArray(value)) {
      const found = (value as Booking[]).find((booking) => booking.id === id);
      if (found) return found;
    }
  }
  return undefined;
}
