import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingStatus } from "./models.ts";

test("a booking with no status field (every existing booking) counts as confirmed", () => {
  assert.equal(bookingStatus({}), "confirmed");
  assert.equal(bookingStatus({ status: "cancelled" }), "cancelled");
  assert.equal(bookingStatus({ status: "pending" }), "pending");
});
