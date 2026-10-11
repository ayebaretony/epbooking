import { useCallback } from "react";
import { listBookingsInRange } from "@/features/bookings/bookings.service";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";

// One year of bookings plus the December before it, so January can be compared with the month just gone (a bounded read)
export function useDashboardData(year: number, version: number) {
  const load = useCallback(() => {
    void version; // reload when a booking is saved anywhere in the app
    return listBookingsInRange(db, `${year - 1}-12-01`, `${year}-12-31`);
  }, [year, version]);
  return useAsyncData(load);
}
