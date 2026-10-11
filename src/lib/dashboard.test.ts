import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking } from "../types/models.ts";
import { bestMonth, latestMonthWithBookings, monthRevenue, previousMonth, revenueByMonth, revenueByPitch, topRepeatClients, utilisation, yearSummary } from "./dashboard.ts";

let counter = 0;
const b = (date: string, total: number, overrides: Partial<Booking> = {}): Booking => ({
  id: `b${counter++}`, pitch: "Fifa Pitch", clientName: "Test Client", contact: "", date, startTime: "18:00", endTime: "19:00", pricePerHour: total, hours: 1, totalPayment: total, ...overrides,
});

test("revenue by month counts confirmed bookings only (no status = confirmed), and only that year", () => {
  const list = [
    b("2026-01-10", 100), // no status: confirmed
    b("2026-01-20", 50.5, { status: "confirmed" }),
    b("2026-01-25", 999, { status: "cancelled" }),
    b("2026-01-26", 777, { status: "pending" }),
    b("2026-03-01", 200),
    b("2025-03-01", 5000),
  ];
  const months = revenueByMonth(list, 2026);
  assert.equal(months.length, 12);
  assert.deepEqual([months[0], months[1], months[2]], [150.5, 0, 200]);
  assert.equal(revenueByMonth(list, 2025)[2], 5000);
});

test("floating-point noise never leaks into the totals", () => {
  const list = [b("2026-05-01", 0.1), b("2026-05-02", 0.2), b("2026-05-03", 790.65), b("2026-05-04", 790.65)];
  assert.equal(revenueByMonth(list, 2026)[4], 1581.6);
});

test("the year summary: revenue, bookings (pending counts, cancelled does not) and the average per confirmed booking", () => {
  const list = [b("2026-02-01", 100), b("2026-02-02", 300, { status: "confirmed" }), b("2026-02-03", 50, { status: "pending" }), b("2026-02-04", 70, { status: "cancelled" }), b("2025-02-04", 9000)];
  assert.deepEqual(yearSummary(list, 2026), { revenue: 400, bookings: 3, averageBooking: 200 });
  assert.deepEqual(yearSummary([], 2026), { revenue: 0, bookings: 0, averageBooking: null });
});

test("free bookings (price 0) are confirmed bookings, so they lower the average rather than disappear", () => {
  assert.equal(yearSummary([b("2026-02-01", 600), b("2026-02-02", 0)], 2026).averageBooking, 300);
});

test("January is compared with the December before it", () => {
  assert.deepEqual(previousMonth(2026, 0), [2025, 11]);
  assert.deepEqual(previousMonth(2026, 5), [2026, 4]);
  const list = [b("2025-12-20", 400), b("2026-01-05", 500)];
  assert.equal(monthRevenue(list, 2025, 11), 400);
  assert.equal(monthRevenue(list, 2026, 0), 500);
});

test("best month and latest month with bookings", () => {
  assert.deepEqual(bestMonth([0, 10, 30, 20]), { month: 2, revenue: 30 });
  assert.equal(bestMonth([0, 0, 0]), null);
  assert.equal(latestMonthWithBookings([b("2026-03-01", 1), b("2026-08-01", 1), b("2026-11-01", 1, { status: "cancelled" })], 2026), 7);
  assert.equal(latestMonthWithBookings([], 2026), null);
});

test("revenue by pitch for a month: every pitch listed, highest first", () => {
  const list = [
    b("2026-05-01", 500, { pitch: "Airdome" }), b("2026-05-09", 300, { pitch: "Airdome" }),
    b("2026-05-02", 900, { pitch: "Fifa Pitch" }),
    b("2026-05-03", 400, { pitch: "Fifa Pitch", status: "cancelled" }),
    b("2026-06-01", 5000, { pitch: "Half Pitch" }),
  ];
  assert.deepEqual(revenueByPitch(list, 2026, 4, ["Fifa Pitch", "Airdome", "Half Pitch"]), [
    { pitch: "Fifa Pitch", revenue: 900 }, { pitch: "Airdome", revenue: 800 }, { pitch: "Half Pitch", revenue: 0 },
  ]);
});

test("repeat clients ignore stray spaces and capital letters, show the most used spelling, and need 2+ bookings", () => {
  const list = [
    b("2026-01-01", 100, { clientName: "Juventus" }), b("2026-01-08", 100, { clientName: "Juventus " }), b("2026-01-15", 100, { clientName: "juventus" }), b("2026-01-22", 100, { clientName: "Juventus" }),
    b("2026-02-01", 500, { clientName: "PSG  Academy" }), b("2026-02-08", 500, { clientName: "PSG Academy" }),
    b("2026-02-09", 50, { clientName: "One Timer" }),
    b("2026-02-10", 80, { clientName: "Cancelled Twice", status: "cancelled" }), b("2026-02-11", 80, { clientName: "Cancelled Twice", status: "cancelled" }),
    b("2025-02-10", 80, { clientName: "Last Year" }), b("2025-02-11", 80, { clientName: "Last Year" }),
  ];
  assert.deepEqual(topRepeatClients(list, 2026), [
    { name: "Juventus", bookings: 4, revenue: 400 },
    { name: "PSG Academy", bookings: 2, revenue: 1000 },
  ]);
  assert.equal(topRepeatClients(list, 2026, 1).length, 1);
});

test("utilisation counts each hour a booking covers, by weekday (Monday first), over only the hours that are used", () => {
  // 2026-10-12 is a Monday, 2026-10-17 a Saturday
  const grid = utilisation(
    [
      b("2026-10-12", 1, { startTime: "17:30", endTime: "19:30" }), // covers the 17, 18 and 19 o'clock hours
      b("2026-10-12", 1, { startTime: "18:00", endTime: "19:00", pitch: "Airdome" }),
      b("2026-10-17", 1, { startTime: "21:00", endTime: "22:00" }),
      b("2026-10-17", 1, { startTime: "09:00", endTime: "10:00", status: "cancelled" }),
    ],
    2026,
  );
  assert.deepEqual(grid.hours, [17, 18, 19, 20, 21]);
  assert.deepEqual(grid.counts[0], [1, 0, 0, 0, 0, 0, 0]); // 17:00 Monday
  assert.deepEqual(grid.counts[1], [2, 0, 0, 0, 0, 0, 0]); // 18:00 Monday: both bookings
  assert.deepEqual(grid.counts[4], [0, 0, 0, 0, 0, 1, 0]); // 21:00 Saturday
  assert.equal(grid.max, 2);
  assert.deepEqual(utilisation([], 2026), { hours: [], counts: [], max: 0 });
});
