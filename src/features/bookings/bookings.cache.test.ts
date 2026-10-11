import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { queryCache } from "../../lib/queryCache.ts";
import type { Booking } from "../../types/models.ts";
import { bookingsFromCachedYear, findCachedBooking, rangeKey, yearKey } from "./bookings.cache.ts";

beforeEach(() => queryCache.clear());

const b = (id: string, date: string): Booking => ({ id, pitch: "Fifa Pitch", clientName: id, contact: "", date, startTime: "18:00", endTime: "19:00", pricePerHour: 1, hours: 1, totalPayment: 1 });

test("names are built the same way everywhere, so a request in progress is shared", () => {
  assert.equal(yearKey(2026), rangeKey("2026-01-01", "2026-12-31"));
});

test("a week or month inside a remembered year is cut out of it, without a database call", () => {
  queryCache.set(yearKey(2026), [b("a", "2026-03-10"), b("b", "2026-10-06"), b("c", "2026-10-20")]);
  assert.deepEqual(bookingsFromCachedYear("2026-10-05", "2026-10-11")?.map((x) => x.id), ["b"]);
  assert.deepEqual(bookingsFromCachedYear("2026-01-01", "2026-05-31")?.map((x) => x.id), ["a"]);
});

test("nothing is cut out when the year is not remembered, the range spans two years, or the year is too old to trust", () => {
  assert.equal(bookingsFromCachedYear("2026-10-05", "2026-10-11"), undefined); // year not loaded
  queryCache.set(yearKey(2026), [b("a", "2026-12-31")]);
  assert.equal(bookingsFromCachedYear("2026-12-28", "2027-01-03"), undefined); // two years
  queryCache.markStale(yearKey(2026));
  assert.equal(bookingsFromCachedYear("2026-12-01", "2026-12-31", 20_000), undefined); // too old to insist on
  assert.deepEqual(bookingsFromCachedYear("2026-12-01", "2026-12-31")?.map((x) => x.id), ["a"]); // but fine to show while refreshing
});

test("a booking already inside any remembered list can be found by its id", () => {
  queryCache.set(yearKey(2026), [b("a", "2026-03-10"), b("target", "2026-04-01")]);
  queryCache.set("pitches", [{ id: "not a booking list" }]); // other things in memory are ignored
  assert.equal(findCachedBooking("target")?.date, "2026-04-01");
  assert.equal(findCachedBooking("missing"), undefined);
});

test("a save clears every remembered booking list at once", () => {
  queryCache.set(yearKey(2026), [b("a", "2026-03-10")]);
  queryCache.set("bookings:years", { first: 2025, last: 2026 });
  queryCache.set("pitches", []);
  queryCache.invalidatePrefix("bookings:");
  assert.equal(bookingsFromCachedYear("2026-03-01", "2026-03-31"), undefined);
  assert.deepEqual(queryCache.get("pitches"), []); // pitches are left alone
});
