import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking } from "../types/models.ts";
import { buildReport, periodDates, periodLabel } from "./report.ts";

let n = 0;
const b = (date: string, total: number, overrides: Partial<Booking> = {}): Booking => ({
  id: `r${n++}`, pitch: "Fifa Pitch", clientName: "Test Client", contact: "0500000000", date, startTime: "18:00", endTime: "19:00", pricePerHour: total, hours: 1, totalPayment: total, ...overrides,
});

test("the period reads naturally and gives the dates to read from the database", () => {
  assert.equal(periodLabel({ year: 2026, fromMonth: 0, toMonth: 4 }), "January – May 2026");
  assert.equal(periodLabel({ year: 2026, fromMonth: 4, toMonth: 4 }), "May 2026");
  assert.deepEqual(periodDates({ year: 2026, fromMonth: 0, toMonth: 4 }), { from: "2026-01-01", to: "2026-05-31" });
  assert.deepEqual(periodDates({ year: 2028, fromMonth: 1, toMonth: 1 }), { from: "2028-02-01", to: "2028-02-29" }); // leap year
});

const sample = [
  b("2026-01-10", 1000, { pitch: "Fifa Pitch", clientName: "Juventus", hours: 2 }),
  b("2026-01-17", 500, { pitch: "Fifa Pitch", clientName: "juventus ", hours: 1 }),
  b("2026-02-03", 300, { pitch: "Airdome", clientName: "Solo", hours: 1.5 }),
  b("2026-02-04", 999, { pitch: "Airdome", clientName: "Cancelled One", status: "cancelled" }),
  b("2026-03-01", 700, { pitch: "Half Pitch", clientName: "Out Of Range" }),
  b("2025-01-10", 9999, { pitch: "Fifa Pitch" }),
  b("2026-02-05", 120, { pitch: "Airdome", clientName: "Pending Person", status: "pending" }),
];

test("a report covers only the chosen months of the chosen year, and never cancelled bookings", () => {
  const report = buildReport(sample, { year: 2026, fromMonth: 0, toMonth: 1 }, ["Fifa Pitch", "Airdome", "Half Pitch"]);
  assert.equal(report.label, "January – February 2026");
  // Jan 10, Jan 17, Feb 3 and the pending Feb 5. The cancelled Feb 4, March and 2025 bookings are out, and it is oldest first.
  assert.deepEqual(report.bookings.map((x) => x.date), ["2026-01-10", "2026-01-17", "2026-02-03", "2026-02-05"]);
  assert.ok(report.bookings.every((x) => x.status !== "cancelled" && x.date >= "2026-01-01" && x.date <= "2026-02-28"));
});

test("the summary, months and pitches add up", () => {
  const report = buildReport(sample, { year: 2026, fromMonth: 0, toMonth: 1 }, ["Fifa Pitch", "Airdome", "Half Pitch"]);
  assert.equal(report.summary.revenue, 1800); // 1000 + 500 + 300; the pending 120 is not revenue
  assert.equal(report.summary.bookings, 4); // pending counts as a booking
  assert.deepEqual(report.months.map((m) => [m.name, m.revenue, m.bookings]), [["January", 1500, 2], ["February", 300, 2]]);
  assert.deepEqual(report.pitches.map((p) => [p.pitch, p.bookings, p.hours, p.revenue]), [["Fifa Pitch", 2, 3, 1500], ["Airdome", 2, 2.5, 300], ["Half Pitch", 0, 0, 0]]);
  assert.equal(report.pitches.reduce((sum, p) => sum + p.revenue, 0), report.summary.revenue);
  assert.equal(report.months.reduce((sum, m) => sum + m.revenue, 0), report.summary.revenue);
});

test("the busiest pitch is the one with the most bookings, and there is none when nothing was booked", () => {
  const report = buildReport(sample, { year: 2026, fromMonth: 0, toMonth: 1 }, ["Fifa Pitch", "Airdome"]);
  assert.equal(report.busiestPitch, "Fifa Pitch"); // ties on 2 bookings go to the higher revenue
  const empty = buildReport(sample, { year: 2024, fromMonth: 0, toMonth: 11 }, ["Fifa Pitch"]);
  assert.equal(empty.busiestPitch, null);
  assert.deepEqual(empty.summary, { revenue: 0, bookings: 0, averageBooking: null });
  assert.equal(empty.bookings.length, 0);
});

test("repeat clients are matched ignoring spaces and capitals", () => {
  const report = buildReport(sample, { year: 2026, fromMonth: 0, toMonth: 1 }, []);
  assert.deepEqual(report.clients, [{ name: "Juventus", bookings: 2, revenue: 1500 }]);
});

test("a pitch that appears on bookings but is not in the pitch list still gets a row", () => {
  const report = buildReport([b("2026-01-10", 100, { pitch: "Old Archived Pitch" })], { year: 2026, fromMonth: 0, toMonth: 0 }, ["Fifa Pitch"]);
  assert.deepEqual(report.pitches.map((p) => p.pitch), ["Old Archived Pitch", "Fifa Pitch"]);
});
