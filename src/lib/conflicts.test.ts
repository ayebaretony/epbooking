import assert from "node:assert/strict";
import { test } from "node:test";
import { fromHHmm, overlapsTaken, slotKey, slotKeysFor, slotStarts, toHHmm } from "./conflicts.ts";

test("toHHmm and fromHHmm convert both ways", () => {
  assert.equal(toHHmm(570), "0930");
  assert.equal(toHHmm(1380), "2300");
  assert.equal(fromHHmm("2330"), 1410);
  assert.equal(fromHHmm(toHHmm(420)), 420);
});

test("slotStarts covers the start but not the end", () => {
  assert.deepEqual(slotStarts(1080, 1170, 30), [1080, 1110, 1140]); // 18:00-19:30
  assert.deepEqual(slotStarts(1080, 1080, 30), []);
});

test("slot keys include the pitch, so different pitches can overlap in time", () => {
  const fifa = slotKeysFor("fifa-pitch", "2026-10-10", 1080, 1140, 30);
  const airdome = slotKeysFor("airdome", "2026-10-10", 1080, 1140, 30);
  assert.deepEqual(fifa, ["fifa-pitch_2026-10-10_1800", "fifa-pitch_2026-10-10_1830"]);
  assert.equal(fifa.filter((key) => airdome.includes(key)).length, 0);
  assert.equal(slotKey("airdome", "2026-10-10", 1080), "airdome_2026-10-10_1800");
});

test("same pitch, overlapping times share a slot key (the second booking fails)", () => {
  const first = slotKeysFor("fifa-pitch", "2026-10-10", 1080, 1170, 30); // 18:00-19:30
  const second = slotKeysFor("fifa-pitch", "2026-10-10", 1140, 1200, 30); // 19:00-20:00
  assert.deepEqual(first.filter((key) => second.includes(key)), ["fifa-pitch_2026-10-10_1900"]);
});

test("back-to-back reservations on the same pitch share no slot (allowed)", () => {
  const first = slotKeysFor("fifa-pitch", "2026-10-10", 1080, 1140, 30); // 18:00-19:00
  const second = slotKeysFor("fifa-pitch", "2026-10-10", 1140, 1200, 30); // 19:00-20:00
  assert.equal(first.filter((key) => second.includes(key)).length, 0);
});

test("overlapsTaken detects a clash with already-taken slots", () => {
  const taken = new Set([1140, 1170]); // 19:00 and 19:30 taken
  assert.equal(overlapsTaken(1080, 1140, 30, taken), false); // 18:00-19:00 ends where 19:00 starts
  assert.equal(overlapsTaken(1080, 1170, 30, taken), true);
});
