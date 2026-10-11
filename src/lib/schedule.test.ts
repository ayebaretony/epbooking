import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking } from "../types/models.ts";
import { dayStats, formatStartsIn, freeSlotCount, nextBooking, pitchSegments, suggestedSlot } from "./schedule.ts";

const OPEN = 7 * 60;
const CLOSE = 23 * 60;
const b = (id: string, start: string, end: string, overrides: Partial<Booking> = {}): Booking => ({
  id, pitch: "Fifa Pitch", clientName: id, contact: "", date: "2026-10-11", startTime: start, endTime: end, pricePerHour: 750, hours: 1, totalPayment: 750, ...overrides,
});

test("a pitch's day is its bookings in order with the free gaps between them", () => {
  const segments = pitchSegments([b("late", "20:00", "21:00"), b("early", "09:00", "10:30")], OPEN, CLOSE);
  assert.deepEqual(
    segments.map((s) => `${s.kind}:${s.start}-${s.end}`),
    ["free:420-540", "booking:540-630", "free:630-1200", "booking:1200-1260", "free:1260-1380"],
  );
  assert.equal((segments[1] as { booking: Booking }).booking.id, "early");
});

test("an empty day is one free gap, and back-to-back bookings leave no gap between them", () => {
  assert.deepEqual(pitchSegments([], OPEN, CLOSE), [{ kind: "free", start: OPEN, end: CLOSE }]);
  const full = pitchSegments([b("a", "07:00", "15:00"), b("b", "15:00", "23:00")], OPEN, CLOSE);
  assert.deepEqual(full.map((s) => s.kind), ["booking", "booking"]);
});

test("cancelled bookings are not drawn, and overlapping ones never sit on top of each other", () => {
  const segments = pitchSegments([b("gone", "18:00", "19:00", { status: "cancelled" }), b("a", "18:00", "19:30"), b("overlap", "19:00", "20:00")], OPEN, CLOSE);
  const drawn = segments.filter((s) => s.kind === "booking").map((s) => `${(s as { booking: Booking }).booking.id}:${s.start}-${s.end}`);
  assert.deepEqual(drawn, ["a:1080-1170", "overlap:1170-1200"]);
});

test("bookings outside the opening window are clipped or ignored without breaking the day", () => {
  const segments = pitchSegments([b("before", "05:00", "06:30"), b("spills", "22:00", "23:30")], OPEN, CLOSE);
  assert.deepEqual(segments.map((s) => `${s.kind}:${s.start}-${s.end}`), ["free:420-1320", "booking:1320-1380"]);
});

test("free slots are counted in 30 minutes, only from now onwards", () => {
  const day = [pitchSegments([b("a", "18:00", "20:00")], OPEN, CLOSE), pitchSegments([], OPEN, CLOSE)];
  assert.equal(freeSlotCount(day, OPEN), (16 * 2 - 4) + 16 * 2); // 28 + 32
  // at 17:10 the next slot boundary is 17:30: pitch 1 has 17:30-18:00 (1) + 20:00-23:00 (6), pitch 2 has 17:30-23:00 (11)
  assert.equal(freeSlotCount(day, 17 * 60 + 10), 1 + 6 + 11);
  assert.equal(freeSlotCount(day, CLOSE), 0);
});

test("the day's numbers skip cancelled bookings, and revenue counts confirmed ones (no status = confirmed)", () => {
  const stats = dayStats([
    b("old-style", "09:00", "10:00", { hours: 1, totalPayment: 750 }),
    b("confirmed", "10:00", "12:00", { hours: 2, totalPayment: 1500, status: "confirmed" }),
    b("pending", "12:00", "13:30", { hours: 1.5, totalPayment: 400, status: "pending" }),
    b("cancelled", "14:00", "15:00", { hours: 1, totalPayment: 999, status: "cancelled" }),
  ]);
  assert.deepEqual(stats, { bookings: 3, hours: 4.5, revenue: 2250 });
  assert.deepEqual(dayStats([]), { bookings: 0, hours: 0, revenue: 0 });
});

test("the next booking is the earliest one that has not started yet", () => {
  const list = [b("later", "20:00", "21:00"), b("sooner", "18:00", "19:00"), b("done", "08:00", "09:00"), b("cancelled", "17:00", "17:30", { status: "cancelled" })];
  assert.equal(nextBooking(list, 17 * 60)?.id, "sooner");
  assert.equal(nextBooking(list, 18 * 60)?.id, "later"); // 18:00 has started
  assert.equal(nextBooking(list, 21 * 60), null);
});

test("countdown text", () => {
  assert.equal(formatStartsIn(80), "Starts in 1h 20m");
  assert.equal(formatStartsIn(45), "Starts in 45m");
  assert.equal(formatStartsIn(120), "Starts in 2h");
  assert.equal(formatStartsIn(0), "Starts in less than a minute");
});

test("a free gap suggests a booking that fits inside it", () => {
  assert.deepEqual(suggestedSlot({ start: 1080, end: 1320 }, 60), { start: 1080, end: 1140 });
  assert.deepEqual(suggestedSlot({ start: 1080, end: 1110 }, 60), { start: 1080, end: 1110 }); // only 30 minutes free
});
