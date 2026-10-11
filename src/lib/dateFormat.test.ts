import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate, formatDateWithDay, formatLongDate, formatMoment } from "./dateFormat.ts";

test("dates read naturally, whatever timezone the computer is in", () => {
  assert.equal(formatDate("2026-11-01"), "1 Nov 2026");
  assert.equal(formatDateWithDay("2026-11-01"), "Sun, 1 Nov 2026");
  assert.equal(formatLongDate("2026-11-01"), "Sunday, 1 November 2026");
});

test("a moment is shown on the business's calendar day (Dubai), not UTC's", () => {
  // 21:30 UTC on 10 Oct is already 11 Oct in Dubai
  assert.equal(formatMoment(new Date("2026-10-10T21:30:00Z"), "Asia/Dubai"), "11 Oct 2026");
});
