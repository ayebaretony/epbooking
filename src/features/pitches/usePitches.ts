import { MAX_AGE } from "@/features/bookings/bookings.cache";
import { useAsyncData } from "@/lib/useAsyncData";
import { PITCHES_KEY, listPitches } from "./pitches.service";

// The pitch list changes rarely, so it is remembered and shared by every screen (and loaded ahead of time at start-up)
export function usePitches() {
  return useAsyncData(listPitches, { cacheKey: PITCHES_KEY, maxAgeMs: MAX_AGE.pitches });
}
