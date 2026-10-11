import assert from "node:assert/strict";
import { test } from "node:test";
import { dayOfMonth, formatDate, formatDateWithDay, formatDayMonth, formatLongDate, formatMoment, formatMonthYear, formatWeekRange, formatWeekdayShort } from "./dateFormat.ts";

test("dates read naturally, whatever timezone the computer is in", () => {
  assert.equal(formatDate("2026-11-01"), "1 Nov 2026");
  assert.equal(formatDateWithDay("2026-11-01"), "Sun, 1 Nov 2026");
  assert.equal(formatLongDate("2026-11-01"), "Sunday, 1 November 2026");
});

test("a moment is shown on the business's calendar day (Dubai), not UTC's", () => {
  // 21:30 UTC on 10 Oct is already 11 Oct in Dubai
  assert.equal(formatMoment(new Date("2026-10-10T21:30:00Z"), "Asia/Dubai"), "11 Oct 2026");
});

test("calendar headings read naturally", () => {
  assert.equal(formatWeekdayShort("2026-10-12"), "Mon");
  assert.equal(formatMonthYear("2026-10-12"), "October 2026");
  assert.equal(formatDayMonth("2026-10-12"), "12 October");
  assert.equal(dayOfMonth("2026-10-05"), 5);
  assert.equal(formatWeekRange("2026-10-12", "2026-10-18"), "12 – 18 Oct 2026");
  assert.equal(formatWeekRange("2026-09-28", "2026-10-04"), "28 Sep – 4 Oct 2026");
  assert.equal(formatWeekRange("2026-12-28", "2027-01-03"), "28 Dec 2026 – 3 Jan 2027");
});
