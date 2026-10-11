import { useCallback } from "react";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";
import { listBookingsForYear } from "../bookings.service";

// `version` goes up whenever a booking is saved anywhere in the app, which reloads the list (without flashing a spinner)
export function useBookingsForYear(year: number, version: number) {
  const load = useCallback(() => {
    void version; // only here to make the list reload when a booking changes
    return listBookingsForYear(db, year);
  }, [year, version]);
  return useAsyncData(load);
}
