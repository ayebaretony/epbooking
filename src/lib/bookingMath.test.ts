import assert from "node:assert/strict";
import { test } from "node:test";
import { durationMinutes, formatHours, minutesToTime, priceBooking, timeToMinutes } from "./bookingMath.ts";
import { aedToFils } from "./money.ts";

test("times convert both ways and reject anything that is not HH:mm", () => {
  assert.equal(timeToMinutes("18:30"), 1110);
  assert.equal(timeToMinutes("07:00"), 420);
  assert.equal(minutesToTime(1110), "18:30");
  for (const bad of ["6pm", "24:00", "18:60", "9:00", ""]) assert.equal(timeToMinutes(bad), null, bad);
});

test("duration needs an end after the start", () => {
  assert.equal(durationMinutes("18:00", "20:00"), 120);
  assert.equal(durationMinutes("18:00", "18:30"), 30);
  assert.equal(durationMinutes("20:00", "18:00"), null);
  assert.equal(durationMinutes("18:00", "18:00"), null);
  assert.equal(durationMinutes("18:00", "nope"), null);
});

test("pricing matches how existing bookings were totalled", () => {
  assert.deepEqual(priceBooking(aedToFils(750), "18:00", "20:00"), { durationMinutes: 120, hours: 2, totalPayment: 1500 });
  assert.deepEqual(priceBooking(aedToFils(527.1), "18:00", "19:30"), { durationMinutes: 90, hours: 1.5, totalPayment: 790.65 });
  assert.deepEqual(priceBooking(0, "18:00", "19:00"), { durationMinutes: 60, hours: 1, totalPayment: 0 }); // a free booking
  assert.equal(priceBooking(aedToFils(750), "20:00", "18:00"), null);
});

test("hours read naturally", () => {
  assert.equal(formatHours(2), "2");
  assert.equal(formatHours(1.5), "1.5");
  assert.equal(formatHours(0.5), "0.5");
});
