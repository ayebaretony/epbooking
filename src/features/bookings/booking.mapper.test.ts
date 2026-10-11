import assert from "node:assert/strict";
import { test } from "node:test";
import { mapBooking } from "./booking.mapper.ts";

// Exactly the nine fields every existing booking has
const legacy = { pitch: "Fifa Pitch", clientName: "Test Client", contact: "0500000000", date: "2026-11-01", startTime: "18:00", endTime: "20:00", pricePerHour: 527.1, hours: 2, totalPayment: 1054.2 };

test("an existing booking maps with no optional fields invented", () => {
  const booking = mapBooking("abc", legacy);
  assert.equal(booking.id, "abc");
  assert.equal(booking.totalPayment, 1054.2);
  for (const key of ["status", "notes", "createdBy", "createdByName", "createdAt", "updatedAt", "seriesId"]) assert.ok(!(key in booking), `${key} should be absent`);
});

test("new-style fields are read, and Firestore timestamps become dates", () => {
  const created = new Date("2026-10-11T10:00:00Z");
  const booking = mapBooking("x", { ...legacy, status: "cancelled", createdBy: "u1", createdByName: "Tony", seriesId: "s1", notes: "hi", createdAt: { toDate: () => created }, updatedAt: created });
  assert.equal(booking.status, "cancelled");
  assert.equal(booking.createdByName, "Tony");
  assert.equal(booking.seriesId, "s1");
  assert.deepEqual(booking.createdAt, created);
  assert.deepEqual(booking.updatedAt, created);
});

test("odd or damaged values never crash and never become fake data", () => {
  const booking = mapBooking("odd", { pitch: 5, clientName: null, pricePerHour: "750", hours: NaN, status: "weird" });
  assert.equal(booking.pitch, "");
  assert.equal(booking.clientName, "");
  assert.equal(booking.pricePerHour, 0);
  assert.equal(booking.hours, 0);
  assert.ok(!("status" in booking));
});
