import { useBookingsInRange } from "@/features/bookings/hooks/useBookingsInRange";
import type { AsyncData } from "@/lib/useAsyncData";
import type { Booking } from "@/types/models";

// One year of bookings plus the December before it, so January can be compared with the month just gone. Both are
// remembered ranges: the year is the same one the Bookings screen uses, so it is usually already there.
export function useDashboardData(year: number, version: number): { state: AsyncData<Booking[]>; reload: () => void } {
  const thisYear = useBookingsInRange(`${year}-01-01`, `${year}-12-31`, version);
  const lastDecember = useBookingsInRange(`${year - 1}-12-01`, `${year - 1}-12-31`, version);
  const reload = () => {
    thisYear.reload();
    lastDecember.reload();
  };
  if (thisYear.state.status === "error" || lastDecember.state.status === "error") return { state: { status: "error" }, reload };
  if (thisYear.state.status === "loading" || lastDecember.state.status === "loading") return { state: { status: "loading" }, reload };
  return { state: { status: "ready", data: [...lastDecember.state.data, ...thisYear.state.data] }, reload };
}
