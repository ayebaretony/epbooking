import { useCallback } from "react";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";
import { MAX_AGE, YEARS_KEY } from "../bookings.cache";
import { getBookingYearRange } from "../bookings.service";

// The years that have bookings, newest first, always including the current year
export function useBookingYears(currentYear: number): number[] {
  const load = useCallback(() => getBookingYearRange(db), []);
  const { state } = useAsyncData(load, { cacheKey: YEARS_KEY, maxAgeMs: MAX_AGE.years });
  const range = state.status === "ready" ? state.data : null;
  const first = Math.min(range?.first ?? currentYear, currentYear);
  const last = Math.max(range?.last ?? currentYear, currentYear);
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
}
