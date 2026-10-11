import assert from "node:assert/strict";
import { test } from "node:test";
import { rateText, validateBookingForm, type BookingFormValues, type ValidateOptions } from "./booking.validation.ts";

const options: ValidateOptions = { pitchNames: ["Fifa Pitch", "Airdome"], openMinutes: 7 * 60, closeMinutes: 23 * 60, requireContact: true, allowRecurrence: true };
const form = (overrides: Partial<BookingFormValues> = {}): BookingFormValues => ({
  pitch: "Fifa Pitch", clientName: "Test Client", contact: "0500000000", date: "2026-11-01", startTime: "18:00", endTime: "20:00", rate: "750", recurrence: "none", count: "4", ...overrides,
});

test("a complete form is accepted, trimmed and priced in AED", () => {
  const result = validateBookingForm(form({ clientName: "  Test Client ", rate: "527.1" }), options);
  assert.ok(result.ok);
  assert.equal(result.value.clientName, "Test Client");
  assert.equal(result.value.rateFils, 52710);
  assert.equal(result.value.pricePerHour, 527.1);
  assert.deepEqual(result.dates, ["2026-11-01"]);
});

test("the price is required, but 0 is allowed (free bookings exist) and nothing is guessed", () => {
  const empty = validateBookingForm(form({ rate: "" }), options);
  assert.ok(!empty.ok && empty.errors.rate === "Enter the price per hour.");
  assert.ok(validateBookingForm(form({ rate: "0" }), options).ok);
  for (const rate of ["abc", "-5", "1.234", "999999999"]) assert.ok(!validateBookingForm(form({ rate }), options).ok, rate);
});

test("times must be real, on the half hour, in order, and inside opening hours", () => {
  const backwards = validateBookingForm(form({ startTime: "20:00", endTime: "18:00" }), options);
  assert.ok(!backwards.ok && backwards.errors.endTime === "End time must be after start time.");
  assert.ok(!validateBookingForm(form({ startTime: "18:10", endTime: "19:00" }), options).ok);
  assert.ok(!validateBookingForm(form({ startTime: "06:00", endTime: "07:00" }), options).ok);
  assert.ok(!validateBookingForm(form({ startTime: "22:00", endTime: "23:30" }), options).ok);
  assert.ok(validateBookingForm(form({ startTime: "22:00", endTime: "23:00" }), options).ok); // the last hour of the day
  assert.ok(!validateBookingForm(form({ startTime: "", endTime: "" }), options).ok);
});

test("pitch, client and date are required; the pitch must be a real one; the date must exist", () => {
  const empty = validateBookingForm(form({ pitch: "", clientName: " ", date: "" }), options);
  assert.ok(!empty.ok && empty.errors.pitch && empty.errors.clientName && empty.errors.date);
  assert.ok(!validateBookingForm(form({ pitch: "Nowhere" }), options).ok);
  assert.ok(!validateBookingForm(form({ date: "2026-02-30" }), options).ok);
});

test("a contact is required for new bookings, but an old booking without one can still be edited", () => {
  assert.ok(!validateBookingForm(form({ contact: "" }), options).ok);
  assert.ok(validateBookingForm(form({ contact: "" }), { ...options, requireContact: false }).ok);
});

test("recurring bookings expand into dates, and the count is checked", () => {
  const weekly = validateBookingForm(form({ recurrence: "weekly", count: "3" }), options);
  assert.ok(weekly.ok);
  assert.deepEqual(weekly.dates, ["2026-11-01", "2026-11-08", "2026-11-15"]);
  const monthly = validateBookingForm(form({ date: "2026-01-31", recurrence: "monthly", count: "3" }), options);
  assert.ok(monthly.ok);
  assert.deepEqual(monthly.dates, ["2026-01-31", "2026-02-28", "2026-03-31"]);
  for (const count of ["1", "0", "53", "2.5", "x"]) assert.ok(!validateBookingForm(form({ recurrence: "weekly", count }), options).ok, count);
  // when editing, recurrence is ignored
  const edit = validateBookingForm(form({ recurrence: "weekly", count: "999" }), { ...options, allowRecurrence: false });
  assert.ok(edit.ok && edit.dates.length === 1 && edit.recurrence === "none");
});

test("an existing price shows in the rate box the way it is written", () => {
  assert.equal(rateText(750), "750");
  assert.equal(rateText(527.1), "527.10");
  assert.equal(rateText(224.07), "224.07");
});
