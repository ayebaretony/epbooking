import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { fetchCached, prefetch, queryCache } from "./queryCache.ts";

beforeEach(() => queryCache.clear());

const later = <T>(value: T, ms = 5) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

test("a loaded value is remembered, and its age is known", async () => {
  assert.equal(queryCache.get("a"), undefined);
  assert.equal(queryCache.ageOf("a"), null);
  assert.equal(await fetchCached("a", () => later(42)), 42);
  assert.equal(queryCache.get("a"), 42);
  assert.ok((queryCache.ageOf("a") ?? -1) >= 0);
});

test("two screens asking for the same thing at once send ONE request", async () => {
  let calls = 0;
  const load = () => (calls++, later("data", 20));
  const [one, two] = await Promise.all([fetchCached("k", load), fetchCached("k", load)]);
  assert.deepEqual([one, two, calls], ["data", "data", 1]);
});

test("invalidating forgets matching entries only, and a request already in flight cannot put old data back", async () => {
  queryCache.set("bookings:2026", [1]);
  queryCache.set("bookings:2025", [2]);
  queryCache.set("pitches", ["p"]);
  queryCache.invalidatePrefix("bookings:");
  assert.deepEqual([queryCache.get("bookings:2026"), queryCache.get("bookings:2025"), queryCache.get("pitches")], [undefined, undefined, ["p"]]);

  const slow = fetchCached("bookings:2024", () => later(["old"], 30)); // started before the change...
  queryCache.invalidatePrefix("bookings:"); // ...then data changes
  assert.deepEqual(await slow, ["old"]); // the caller still gets its answer
  assert.equal(queryCache.get("bookings:2024"), undefined); // but it is not remembered as if it were fresh
});

test("a failed load is not remembered, and the next ask tries again", async () => {
  await assert.rejects(fetchCached("x", () => Promise.reject(new Error("offline"))));
  assert.equal(queryCache.get("x"), undefined);
  assert.equal(await fetchCached("x", () => later("ok")), "ok");
});

test("prefetch fills the memory in the background, skips fresh entries, and never throws", async () => {
  let calls = 0;
  prefetch("p", () => (calls++, later("one")), 60_000);
  await later(null, 30);
  assert.equal(queryCache.get("p"), "one");
  prefetch("p", () => (calls++, later("two")), 60_000); // still fresh: not loaded again
  await later(null, 30);
  assert.deepEqual([queryCache.get("p"), calls], ["one", 1]);
  assert.doesNotThrow(() => prefetch("bad", () => Promise.reject(new Error("no")), 1000));
  await later(null, 30);
  assert.equal(queryCache.get("bad"), undefined);
});

test("entries can be found by prefix", () => {
  queryCache.set("bookings:2026-01-01:2026-12-31", []);
  queryCache.set("bookings:2026-10-05:2026-10-11", []);
  queryCache.set("pitches", []);
  assert.deepEqual(queryCache.keysWithPrefix("bookings:").sort(), ["bookings:2026-01-01:2026-12-31", "bookings:2026-10-05:2026-10-11"]);
});

test("marking an entry stale keeps its data but makes it old enough to be reloaded", () => {
  queryCache.set("s", [1, 2]);
  queryCache.markStale("s");
  assert.deepEqual(queryCache.get("s"), [1, 2]); // still there to show
  assert.ok((queryCache.ageOf("s") ?? 0) > 60_000 * 60); // but treated as long out of date
  queryCache.markStale("never-loaded"); // harmless
  assert.equal(queryCache.get("never-loaded"), undefined);
});
