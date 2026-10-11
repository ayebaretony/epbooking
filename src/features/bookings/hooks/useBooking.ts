import { useCallback } from "react";
import { db } from "@/lib/firebase";
import { useAsyncData } from "@/lib/useAsyncData";
import { getBooking } from "../bookings.service";

export function useBooking(id: string, version: number) {
  const load = useCallback(() => {
    void version; // reload after the booking is edited or cancelled
    return getBooking(db, id);
  }, [id, version]);
  return useAsyncData(load);
}
