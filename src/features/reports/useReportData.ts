import { useBookingsInRange } from "@/features/bookings/hooks/useBookingsInRange";
import { periodDates, type ReportPeriod } from "@/lib/report";

// The bookings inside the applied period. A period within a year that is already loaded costs no database call.
export function useReportData(period: ReportPeriod, version: number) {
  const { from, to } = periodDates(period);
  return useBookingsInRange(from, to, version);
}
