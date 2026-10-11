import { useCallback } from "react";
import { listBookingsInRange } from "@/features/bookings/bookings.service";
import { db } from "@/lib/firebase";
import { periodDates, type ReportPeriod } from "@/lib/report";
import { useAsyncData } from "@/lib/useAsyncData";

// The bookings inside the applied period (a bounded read), reloaded when a booking is saved anywhere in the app
export function useReportData(period: ReportPeriod, version: number) {
  const { year, fromMonth, toMonth } = period;
  const load = useCallback(() => {
    void version;
    const { from, to } = periodDates({ year, fromMonth, toMonth });
    return listBookingsInRange(db, from, to);
  }, [year, fromMonth, toMonth, version]);
  return useAsyncData(load);
}
