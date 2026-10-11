import { useEffect, useState } from "react";
import { conflictingDates } from "@/lib/availability";
import { db } from "@/lib/firebase";
import { fetchTakenSlots } from "../bookings.service";

export type Availability =
  | { status: "idle" } // not enough filled in yet to check
  | { status: "checking" }
  | { status: "available" }
  | { status: "conflict"; dates: string[] }
  | { status: "error" };

// Checks, a moment after the person stops typing, whether the chosen pitch and time are free on every date. Takes plain
// values (datesKey is the dates joined with commas) so it only re-runs when something really changed.
export function useSlotAvailability(enabled: boolean, pitch: string, datesKey: string, startTime: string, endTime: string, ignoreBookingId: string | undefined): Availability {
  const key = `${pitch}|${datesKey}|${startTime}|${endTime}|${ignoreBookingId ?? ""}`;
  const [result, setResult] = useState<{ key: string; availability: Availability } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let availability: Availability;
      try {
        const dates = datesKey.split(",");
        const taken = await fetchTakenSlots(db, pitch, dates);
        const clashes = conflictingDates(taken, pitch, dates, startTime, endTime, ignoreBookingId);
        availability = clashes.length > 0 ? { status: "conflict", dates: clashes } : { status: "available" };
      } catch {
        availability = { status: "error" };
      }
      if (!cancelled) setResult({ key, availability });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, key, pitch, datesKey, startTime, endTime, ignoreBookingId]);

  if (!enabled) return { status: "idle" };
  return result?.key === key ? result.availability : { status: "checking" };
}
