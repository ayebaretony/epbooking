import assert from "node:assert/strict";
import { test } from "node:test";
import { planSlotBackfill, seedPitchesFromBookings, type BackfillBooking } from "./backfill.ts";
import { nextUnusedColor } from "./pitchColors.ts";

const booking = (id: string, overrides: Partial<BackfillBooking> = {}): BackfillBooking => ({
  id,
  pitch: "Fifa Pitch",
  date: "2026-11-01",
  startTime: "18:00",
  endTime: "19:30",
  ...overrides,
});

test("a booking becomes one slot per 30 minutes, keyed by pitch, date and start time", () => {
  const plan = planSlotBackfill([booking("b1")]);
  assert.deepEqual(
    plan.slots.map((slot) => slot.id),
    ["fifa-pitch_2026-11-01_1800", "fifa-pitch_2026-11-01_1830", "fifa-pitch_2026-11-01_1900"],
  );
  assert.deepEqual(plan.slots[0], { id: "fifa-pitch_2026-11-01_1800", pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "b1" });
  assert.equal(plan.expectedSlotCount, 3);
  assert.deepEqual(plan.collisions, []);
  assert.deepEqual(plan.skipped, []);
});

test("back-to-back bookings and different pitches at the same time do not collide", () => {
  const plan = planSlotBackfill([
    booking("b1", { startTime: "18:00", endTime: "19:00" }),
    booking("b2", { startTime: "19:00", endTime: "20:00" }),
    booking("b3", { pitch: "Airdome", startTime: "18:00", endTime: "19:00" }),
  ]);
  assert.equal(plan.slots.length, 6);
  assert.deepEqual(plan.collisions, []);
});

test("overlapping bookings on the same pitch are reported, and the first keeps the slot", () => {
  const plan = planSlotBackfill([
    booking("b1", { startTime: "18:00", endTime: "19:00" }),
    booking("b2", { startTime: "18:30", endTime: "19:30" }),
  ]);
  assert.deepEqual(plan.collisions, [{ slotId: "fifa-pitch_2026-11-01_1830", bookingIds: ["b1", "b2"] }]);
  const owner = plan.slots.find((slot) => slot.id === "fifa-pitch_2026-11-01_1830");
  assert.equal(owner?.bookingId, "b1");
  assert.equal(plan.expectedSlotCount, 4); // what the bookings need, even though one slot is contested
  assert.equal(plan.slots.length, 3);
});

test("cancelled bookings, bad times and off-grid times take no slots and say why", () => {
  const plan = planSlotBackfill([
    booking("cancelled", { status: "cancelled" }),
    booking("backwards", { startTime: "19:00", endTime: "18:00" }),
    booking("junk", { startTime: "6pm" }),
    booking("offgrid", { startTime: "18:10", endTime: "19:00" }),
    booking("fine"),
  ]);
  assert.deepEqual(plan.skipped.map((s) => s.bookingId), ["cancelled", "backwards", "junk", "offgrid"]);
  assert.equal(plan.skipped[0].reason, "cancelled");
  assert.match(plan.skipped[3].reason, /30-minute grid/);
  assert.equal(plan.slots.length, 3);
});

test("pitches are seeded from the names on bookings, with NO price (each client's rate is negotiated)", () => {
  const seeds = seedPitchesFromBookings([
    booking("a", { pitch: "Airdome" }),
    booking("b", { pitch: "Airdome" }),
    booking("c", { pitch: "Half Pitch" }),
    booking("d", { pitch: "Fifa Pitch" }),
    booking("e", { pitch: "Junior Football Pitch" }),
  ]);
  assert.deepEqual(seeds.map((s) => s.id), ["fifa-pitch", "airdome", "junior-football-pitch", "half-pitch"]);
  assert.deepEqual(seeds.map((s) => s.color), ["green", "blue", "amber", "purple"]);
  assert.equal(seeds[0].name, "Fifa Pitch"); // names are kept exactly, bookings refer to them
  assert.ok(seeds.every((s) => s.archived === false && !("defaultRatePerHour" in s)));
});

test("a pitch name that is not one of the four gets the next unused colour", () => {
  const seeds = seedPitchesFromBookings([booking("a"), booking("b", { pitch: "Beach Pitch" })]);
  assert.equal(seeds.find((s) => s.id === "beach-pitch")?.color, "blue"); // green is taken by Fifa Pitch
  assert.equal(nextUnusedColor(["green", "blue", "amber", "purple", "rose", "teal"]), "green"); // wraps when all are used
});
