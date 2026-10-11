import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheProfile, clearCachedProfile, readCachedProfile } from "./profileCache.ts";

function fakeStorage() {
  const data: Record<string, string> = {};
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k] };
}
const admin = { displayName: "Tony", email: "t@example.com", role: "admin" as const, active: true };

test("an approved profile is remembered per person and read back", () => {
  const storage = fakeStorage();
  cacheProfile("u1", admin, storage);
  assert.deepEqual(readCachedProfile("u1", storage), admin);
  assert.equal(readCachedProfile("u2", storage), null); // someone else on the same device gets nothing
});

test("a profile that is not approved is never remembered, and forgets an earlier one", () => {
  const storage = fakeStorage();
  cacheProfile("u1", admin, storage);
  cacheProfile("u1", { ...admin, active: false }, storage);
  assert.equal(readCachedProfile("u1", storage), null);
});

test("damaged or tampered values are ignored rather than trusted", () => {
  const storage = fakeStorage();
  for (const raw of ["not json", "{}", JSON.stringify({ ...admin, role: "owner" }), JSON.stringify({ ...admin, active: "yes" }), JSON.stringify({ ...admin, active: false })]) {
    storage.data["epbooking.profile.u1"] = raw;
    assert.equal(readCachedProfile("u1", storage), null, raw);
  }
});

test("signing out forgets it, and blocked storage is tolerated", () => {
  const storage = fakeStorage();
  cacheProfile("u1", admin, storage);
  clearCachedProfile("u1", storage);
  assert.equal(readCachedProfile("u1", storage), null);
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  assert.equal(readCachedProfile("u1", blocked), null);
  assert.doesNotThrow(() => cacheProfile("u1", admin, blocked));
  assert.doesNotThrow(() => clearCachedProfile("u1", blocked));
  assert.equal(readCachedProfile("u1", null), null);
});
