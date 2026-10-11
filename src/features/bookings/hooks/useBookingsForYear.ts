import { useBookingsInRange } from "./useBookingsInRange";

// One calendar year of bookings (the same remembered range the Dashboard and Reports use)
export function useBookingsForYear(year: number, version: number) {
  return useBookingsInRange(`${year}-01-01`, `${year}-12-31`, version);
}
