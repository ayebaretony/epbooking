import { MAX_AGE, YEARS_KEY, rangeKey, yearKey } from "@/features/bookings/bookings.cache";
import { getBookingYearRange, listBookingsInRange } from "@/features/bookings/bookings.service";
import { PITCHES_KEY, listPitches } from "@/features/pitches/pitches.service";
import { db } from "@/lib/firebase";
import { prefetch } from "@/lib/queryCache";
import { todayInTimezone } from "@/lib/time";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";

// As soon as someone is in, start loading what nearly every screen needs, all at once: the pitches, the list of years, this
// year's bookings, and last December (for the Dashboard's month comparison). By the time they open a page it is already there.
export function prefetchEssentials(): void {
  const year = Number(todayInTimezone(DEFAULT_CENTER_SETTINGS.timezone).slice(0, 4));
  prefetch(PITCHES_KEY, listPitches, MAX_AGE.pitches);
  prefetch(YEARS_KEY, () => getBookingYearRange(db), MAX_AGE.years);
  prefetch(yearKey(year), () => listBookingsInRange(db, `${year}-01-01`, `${year}-12-31`), MAX_AGE.bookings);
  prefetch(rangeKey(`${year - 1}-12-01`, `${year - 1}-12-31`), () => listBookingsInRange(db, `${year - 1}-12-01`, `${year - 1}-12-31`), MAX_AGE.bookings);
}
