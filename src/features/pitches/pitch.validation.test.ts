import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePitchForm } from "./pitch.validation.ts";

const form = (overrides: Partial<Record<"name" | "description" | "rate" | "color", string>> = {}) => ({
  name: "Beach Pitch",
  description: "5-a-side",
  rate: "",
  color: "teal",
  ...overrides,
});

test("a pitch needs no price: an empty rate is saved as 'not set'", () => {
  const result = validatePitchForm(form(), ["fifa-pitch"], false);
  assert.ok(result.ok);
  assert.equal(result.value.defaultRatePerHour, null);
  assert.equal(result.value.name, "Beach Pitch");
});

test("a rate, when given, must be a valid AED amount", () => {
  const ok = validatePitchForm(form({ rate: "527.10" }), [], false);
  assert.ok(ok.ok && ok.value.defaultRatePerHour === 527.1);
  for (const rate of ["abc", "-5", "1.234", "12,5x"]) {
    const bad = validatePitchForm(form({ rate }), [], false);
    assert.ok(!bad.ok && bad.errors.rate, `"${rate}" should be rejected`);
  }
});

test("the name is required, trimmed, and cannot reuse an existing pitch (bookings refer to pitches by name)", () => {
  assert.ok(!validatePitchForm(form({ name: "  " }), [], false).ok);
  assert.ok(!validatePitchForm(form({ name: "!!!" }), [], false).ok);
  const trimmed = validatePitchForm(form({ name: "  Beach Pitch  " }), [], false);
  assert.ok(trimmed.ok && trimmed.value.name === "Beach Pitch");
  const clash = validatePitchForm(form({ name: "fifa  PITCH" }), ["fifa-pitch"], false);
  assert.ok(!clash.ok && clash.errors.name === "A pitch with this name already exists.");
  assert.ok(validatePitchForm(form({ name: "Fifa Pitch" }), ["fifa-pitch"], true).ok); // editing keeps its own name
});

test("the colour must come from the palette", () => {
  const bad = validatePitchForm(form({ color: "hotpink" }), [], false);
  assert.ok(!bad.ok && bad.errors.color);
});
