import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePhone, telHref, whatsappHref } from "./phone.ts";

test("the layouts found on existing bookings all become the same international number", () => {
  const expected = "+971501234567";
  for (const raw of ["0501234567", "050 123 4567", "+971 50 123 4567", "+971501234567", "971501234567", "971 50 123 4567", "00971501234567", "501234567", "+971 (0)50 123 4567"]) {
    assert.equal(normalizePhone(raw), expected, raw);
  }
});

test("another country's number is kept, and anything unreadable gives null", () => {
  assert.equal(normalizePhone("+44 7700 900123"), "+447700900123");
  for (const raw of ["", "   ", "someone@example.com", "call Ali", "12345", "123456789"]) assert.equal(normalizePhone(raw), null, JSON.stringify(raw));
});

test("call and WhatsApp links are built from the normalised number only", () => {
  assert.equal(telHref("0501234567"), "tel:+971501234567");
  assert.equal(whatsappHref("0501234567"), "https://wa.me/971501234567");
  assert.equal(telHref("nope"), null);
  assert.equal(whatsappHref(""), null);
});
