import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking } from "../../types/models.ts";
import { filterBookings, paginate, sortBookings } from "./bookings.filter.ts";

const b = (id: string, overrides: Partial<Booking> = {}): Booking => ({
  id, pitch: "Fifa Pitch", clientName: "Test Client", contact: "0500000000", date: "2026-03-10", startTime: "18:00", endTime: "19:00", pricePerHour: 750, hours: 1, totalPayment: 750, ...overrides,
});
const list = [
  b("1", { clientName: "Marwan FC", date: "2026-03-10", pitch: "Airdome" }),
  b("2", { clientName: "Dubai Lions", date: "2026-04-02", contact: "+971 50 111 2222" }),
  b("3", { clientName: "Corporate League", date: "2026-03-10", startTime: "20:00" }),
];

test("search matches the client name or the contact, ignoring case", () => {
  assert.deepEqual(filterBookings(list, { search: "marwan", pitch: "", month: "" }).map((x) => x.id), ["1"]);
  assert.deepEqual(filterBookings(list, { search: "111 2222", pitch: "", month: "" }).map((x) => x.id), ["2"]);
  assert.equal(filterBookings(list, { search: "  ", pitch: "", month: "" }).length, 3);
});

test("pitch and month filters combine", () => {
  assert.deepEqual(filterBookings(list, { search: "", pitch: "Airdome", month: "" }).map((x) => x.id), ["1"]);
  assert.deepEqual(filterBookings(list, { search: "", pitch: "", month: "2" }).map((x) => x.id), ["1", "3"]); // March = 2
  assert.deepEqual(filterBookings(list, { search: "", pitch: "Airdome", month: "3" }).map((x) => x.id), []);
});

test("sorting is by date then start time, newest or oldest first, and never changes the original", () => {
  assert.deepEqual(sortBookings(list, "newest").map((x) => x.id), ["2", "3", "1"]);
  assert.deepEqual(sortBookings(list, "oldest").map((x) => x.id), ["1", "3", "2"]);
  assert.deepEqual(list.map((x) => x.id), ["1", "2", "3"]);
});

test("pages report what is shown and stay in range", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 1, 10), { items: items.slice(0, 10), page: 1, pageCount: 3, from: 1, to: 10, total: 25 });
  assert.deepEqual(paginate(items, 3, 10).items, [21, 22, 23, 24, 25]);
  assert.equal(paginate(items, 99, 10).page, 3);
  assert.equal(paginate(items, -4, 10).page, 1);
  assert.deepEqual(paginate([], 1, 10), { items: [], page: 1, pageCount: 1, from: 0, to: 0, total: 0 });
});
