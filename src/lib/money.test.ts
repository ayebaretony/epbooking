import assert from "node:assert/strict";
import { test } from "node:test";
import { aedToFils, calcTotalMinor, filsToAed, formatMoney, formatRate, minorToMajorInput, parseMajorToMinor } from "./money.ts";

// Intl puts a non-breaking space after "AED"; compare with a normal one.
const plain = (text: string) => text.replace(/\u00a0/g, " ");

test("formatMoney shows whole amounts without decimals and fils with two", () => {
  assert.equal(plain(formatMoney(75000, "AED")), "AED 750");
  assert.equal(plain(formatMoney(52710, "AED")), "AED 527.10");
  assert.equal(plain(formatMoney(22407, "AED")), "AED 224.07");
  assert.equal(plain(formatRate(40000, "AED")), "AED 400/hr");
});

test("parseMajorToMinor accepts up to two decimals and rejects the rest", () => {
  assert.equal(parseMajorToMinor("750"), 75000);
  assert.equal(parseMajorToMinor("527.1"), 52710);
  assert.equal(parseMajorToMinor("1,200.50"), 120050);
  assert.equal(parseMajorToMinor("224.07"), 22407);
  assert.equal(parseMajorToMinor("1.234"), null);
  assert.equal(parseMajorToMinor("-5"), null);
  assert.equal(parseMajorToMinor("abc"), null);
  assert.equal(parseMajorToMinor(""), null);
});

test("minorToMajorInput round-trips with parseMajorToMinor", () => {
  for (const minor of [75000, 52710, 22407, 25000, 1]) {
    assert.equal(parseMajorToMinor(minorToMajorInput(minor)), minor);
  }
});

test("calcTotalMinor charges partial hours proportionally and rounds once", () => {
  assert.equal(calcTotalMinor(75000, 120), 150000); // 2h at AED 750
  assert.equal(calcTotalMinor(25000, 90), 37500); // 1.5h at AED 250
  assert.equal(calcTotalMinor(52710, 90), 79065); // 1.5h at AED 527.10
  assert.equal(calcTotalMinor(10001, 30), 5001); // 5000.5 rounds up once, to whole fils
});

test("aedToFils and filsToAed convert legacy AED numbers without losing a fil", () => {
  assert.equal(aedToFils(527.1), 52710);
  assert.equal(aedToFils(224.07), 22407);
  assert.equal(aedToFils(790.65), 79065);
  for (const aed of [750, 527.1, 224.07, 400, 0.05]) {
    assert.equal(filsToAed(aedToFils(aed)), aed); // writes back exactly what was stored
  }
});

test("the new price rule reproduces how existing bookings were totalled", () => {
  // 1.5 hours at AED 527.10 was stored as 790.65; 2 hours at AED 224.07 as 448.14
  assert.equal(filsToAed(calcTotalMinor(aedToFils(527.1), 90)), 790.65);
  assert.equal(filsToAed(calcTotalMinor(aedToFils(224.07), 120)), 448.14);
});
