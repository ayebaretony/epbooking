import { slotKeysFor, pitchSlug } from "./conflicts.ts";
import { SLOT_MINUTES, timeToMinutes } from "./bookingMath.ts";

// slotId -> the booking that owns it, for slots that are already taken
export type TakenSlots = ReadonlyMap<string, string>;

// Which of these dates already have part of the time taken on that pitch. `ignoreBookingId` is the booking being edited:
// its own slots never count as a clash with itself.
export function conflictingDates(
  taken: TakenSlots,
  pitch: string,
  dates: readonly string[],
  startTime: string,
  endTime: string,
  ignoreBookingId?: string,
): string[] {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return [];
  return dates.filter((date) =>
    slotKeysFor(pitchSlug(pitch), date, start, end, SLOT_MINUTES).some((key) => {
      const owner = taken.get(key);
      return owner !== undefined && owner !== ignoreBookingId;
    }),
  );
}
