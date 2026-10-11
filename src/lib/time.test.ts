import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, addMonths, dayOfWeekMonday, minutesOfDay, monthEnd, monthGridDates, monthStart, parseHHmm, todayInTimezone, weekDates, weekStartMonday, zonedDateTime } from "./time.ts";

const DUBAI = "Asia/Dubai"; // UTC+4, no daylight saving

test("zonedDateTime turns a Dubai wall-clock time into the right UTC moment", () => {
  assert.equal(zonedDateTime("2026-10-10", 18 * 60, DUBAI).toISOString(), "2026-10-10T14:00:00.000Z");
  // 23:00 Dubai is still the same calendar day in UTC; 02:00 Dubai is the previous day in UTC
  assert.equal(zonedDateTime("2026-10-10", 23 * 60, DUBAI).toISOString(), "2026-10-10T19:00:00.000Z");
  assert.equal(zonedDateTime("2026-10-10", 2 * 60, DUBAI).toISOString(), "2026-10-09T22:00:00.000Z");
});

test("minutesOfDay and parseHHmm agree with zonedDateTime", () => {
  assert.equal(parseHHmm("07:00"), 420);
  assert.equal(minutesOfDay(zonedDateTime("2026-10-10", 1110, DUBAI), DUBAI), 1110);
});

test("todayInTimezone uses the center's calendar day, not UTC's", () => {
  // 21:30 UTC on 10 Oct is already 01:30 on 11 Oct in Dubai
  assert.equal(todayInTimezone(DUBAI, new Date("2026-10-10T21:30:00Z")), "2026-10-11");
  assert.equal(todayInTimezone(DUBAI, new Date("2026-10-10T10:00:00Z")), "2026-10-10");
});

test("addDays steps weekly series without timezone drift", () => {
  assert.equal(addDays("2026-10-10", 7), "2026-10-17");
  assert.equal(addDays("2026-10-28", 7), "2026-11-04");
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
});

test("addMonths clamps to month end and never drifts when counted from the original date", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 2), "2026-03-31"); // legacy app drifted to Mar 3 / Mar 6 here
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29"); // leap year
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
});

test("weeks run Monday to Sunday", () => {
  assert.equal(dayOfWeekMonday("2026-10-12"), 0); // a Monday
  assert.equal(dayOfWeekMonday("2026-10-18"), 6); // a Sunday
  assert.equal(weekStartMonday("2026-10-14"), "2026-10-12");
  assert.equal(weekStartMonday("2026-10-12"), "2026-10-12");
  assert.equal(weekStartMonday("2026-10-18"), "2026-10-12");
  assert.deepEqual(weekDates("2026-10-14"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  assert.deepEqual(weekDates("2026-12-31").slice(-1), ["2027-01-03"]); // across a year end
});

test("a month grid is six Monday-first weeks that contain the whole month", () => {
  assert.equal(monthStart("2026-10-14"), "2026-10-01");
  assert.equal(monthEnd("2026-10-14"), "2026-10-31");
  assert.equal(monthEnd("2028-02-10"), "2028-02-29");
  const grid = monthGridDates("2026-10-14");
  assert.equal(grid.length, 42);
  assert.equal(grid[0], "2026-09-28"); // 1 Oct 2026 is a Thursday, so the grid starts on the Monday before
  assert.ok(grid.includes("2026-10-01") && grid.includes("2026-10-31"));
  assert.equal(dayOfWeekMonday(grid[0]), 0);
});
