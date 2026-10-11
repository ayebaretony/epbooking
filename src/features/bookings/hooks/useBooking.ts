import { useCallback } from "react";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";
import { MAX_AGE, bookingKey, findCachedBooking } from "../bookings.cache";
import { getBooking } from "../bookings.service";

// One booking. If it is already inside a list that was loaded, its page opens at once and is refreshed in the background.
export function useBooking(id: string, version: number) {
  const load = useCallback(() => {
    void version;
    return getBooking(db, id);
  }, [id, version]);
  const seed = useCallback(() => findCachedBooking(id), [id]);
  return useAsyncData(load, { cacheKey: bookingKey(id), maxAgeMs: MAX_AGE.bookings, seed });
}
