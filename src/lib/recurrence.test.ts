import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_OCCURRENCES, occurrenceDates } from "./recurrence.ts";

test("a one-off booking is just its own date", () => {
  assert.deepEqual(occurrenceDates("2026-10-10", "none", 5), ["2026-10-10"]);
});

test("weekly series step by seven days, first date included, across month and year ends", () => {
  assert.deepEqual(occurrenceDates("2026-10-10", "weekly", 4), ["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]);
  assert.deepEqual(occurrenceDates("2026-12-25", "weekly", 3), ["2026-12-25", "2027-01-01", "2027-01-08"]);
});

test("monthly series never drift past short months", () => {
  assert.deepEqual(occurrenceDates("2026-01-31", "monthly", 4), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(occurrenceDates("2028-01-31", "monthly", 2), ["2028-01-31", "2028-02-29"]);
});

test("the count is kept within sensible limits", () => {
  assert.equal(occurrenceDates("2026-10-10", "weekly", 1000).length, MAX_OCCURRENCES);
  assert.equal(occurrenceDates("2026-10-10", "weekly", 0).length, 1);
});
