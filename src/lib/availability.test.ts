import assert from "node:assert/strict";
import { test } from "node:test";
import { conflictingDates, type TakenSlots } from "./availability.ts";

// 18:00-19:00 on 2026-11-01 is taken on the Fifa Pitch by booking "b1"
const taken: TakenSlots = new Map([
  ["fifa-pitch_2026-11-01_1800", "b1"],
  ["fifa-pitch_2026-11-01_1830", "b1"],
]);

test("an overlapping time on the same pitch clashes", () => {
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-01"], "18:30", "19:30"), ["2026-11-01"]);
});

test("back-to-back, another pitch and another day do not clash", () => {
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-01"], "19:00", "20:00"), []);
  assert.deepEqual(conflictingDates(taken, "Airdome", ["2026-11-01"], "18:00", "19:00"), []);
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-08"], "18:00", "19:00"), []);
});

test("a series reports exactly the dates that clash", () => {
  const series = ["2026-10-25", "2026-11-01", "2026-11-08"];
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", series, "18:00", "19:00"), ["2026-11-01"]);
});

test("the booking being edited never clashes with itself", () => {
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-01"], "18:00", "19:00", "b1"), []);
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-01"], "18:00", "19:00", "someone-else"), ["2026-11-01"]);
});

test("invalid times give no clashes rather than crashing", () => {
  assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-01"], "x", "y"), []);
});
