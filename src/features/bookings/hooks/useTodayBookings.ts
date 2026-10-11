import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Booking } from "@/types/models";
import { subscribeToDay } from "../bookings.service";

type Feed = { date: string; attempt: number; result: { status: "ready"; data: Booking[] } | { status: "error" } };
export type TodayBookings = { status: "loading" } | { status: "ready"; data: Booking[] } | { status: "error" };

// One day's bookings, kept live: a booking made on another phone shows up here without reloading. It starts listening
// again when the date changes (midnight) or after `retry()`.
export function useTodayBookings(date: string): { state: TodayBookings; retry: () => void } {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    return subscribeToDay(
      db,
      date,
      (data) => setFeed({ date, attempt, result: { status: "ready", data } }),
      () => setFeed({ date, attempt, result: { status: "error" } }),
    );
  }, [date, attempt]);

  // Anything left over from another date or an earlier attempt counts as still loading
  const state: TodayBookings = feed && feed.date === date && feed.attempt === attempt ? feed.result : { status: "loading" };
  return { state, retry: () => setAttempt((current) => current + 1) };
}
