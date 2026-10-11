import { useCallback } from "react";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";
import { listBookingsInRange } from "../bookings.service";

// Bookings between two dates, reloaded whenever a booking is saved anywhere in the app (`version`)
export function useBookingsInRange(from: string, to: string, version: number) {
  const load = useCallback(() => {
    void version;
    return listBookingsInRange(db, from, to);
  }, [from, to, version]);
  return useAsyncData(load);
}
