import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_DURATION_MINUTES, formatDurationOption, readDefaultDuration, saveDefaultDuration } from "./preferences.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => void (data[key] = value) };
}

test("the default duration is 1 hour until a valid choice is saved", () => {
  assert.equal(readDefaultDuration(fakeStorage()), DEFAULT_DURATION_MINUTES);
  assert.equal(readDefaultDuration(null), DEFAULT_DURATION_MINUTES);
  const storage = fakeStorage();
  saveDefaultDuration(storage, 90);
  assert.equal(readDefaultDuration(storage), 90);
});

test("nonsense in storage, or an unsupported duration, never gets through", () => {
  assert.equal(readDefaultDuration(fakeStorage({ "epbooking.defaultDurationMinutes": "banana" })), DEFAULT_DURATION_MINUTES);
  assert.equal(readDefaultDuration(fakeStorage({ "epbooking.defaultDurationMinutes": "45" })), DEFAULT_DURATION_MINUTES);
  const storage = fakeStorage();
  saveDefaultDuration(storage, 45);
  assert.deepEqual(storage.data, {});
});

test("blocked storage is tolerated", () => {
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readDefaultDuration(blocked), DEFAULT_DURATION_MINUTES);
  assert.doesNotThrow(() => saveDefaultDuration(blocked, 60));
});

test("durations read naturally", () => {
  assert.equal(formatDurationOption(30), "30 minutes");
  assert.equal(formatDurationOption(60), "1 hour");
  assert.equal(formatDurationOption(90), "1.5 hours");
  assert.equal(formatDurationOption(120), "2 hours");
});
