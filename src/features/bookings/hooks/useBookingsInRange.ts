import { useCallback } from "react";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";
import { MAX_AGE, bookingsFromCachedYear, rangeKey } from "../bookings.cache";
import { listBookingsInRange } from "../bookings.service";

// Bookings between two dates. Remembered per range, and a week or month inside a year that is already loaded is cut out of
// that year instead of asking the database. `version` goes up when a booking is saved (the memory is cleared too).
export function useBookingsInRange(from: string, to: string, version: number) {
  const load = useCallback(async () => {
    void version;
    const fromYear = bookingsFromCachedYear(from, to, MAX_AGE.bookings);
    return fromYear ?? listBookingsInRange(db, from, to);
  }, [from, to, version]);
  const seed = useCallback(() => bookingsFromCachedYear(from, to), [from, to]);
  return useAsyncData(load, { cacheKey: rangeKey(from, to), maxAgeMs: MAX_AGE.bookings, seed });
}
