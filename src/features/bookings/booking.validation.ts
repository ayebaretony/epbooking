// Validation for the new / edit booking form. Pure, with relative .ts imports so `npm test` can run it.
import { SLOT_MINUTES, timeToMinutes } from "../../lib/bookingMath.ts";
import { aedToFils, filsToAed, parseMajorToMinor } from "../../lib/money.ts";
import { MAX_OCCURRENCES, MIN_OCCURRENCES, occurrenceDates, type RecurrenceType } from "../../lib/recurrence.ts";

export type BookingFormValues = {
  pitch: string;
  clientName: string;
  contact: string;
  date: string;
  startTime: string;
  endTime: string;
  rate: string; // AED per hour, as typed
  recurrence: RecurrenceType;
  count: string; // how many bookings in a recurring series, first one included
};

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

// What gets saved (the price is calculated from rateFils, startTime and endTime by priceBooking)
export type BookingInput = {
  pitch: string;
  clientName: string;
  contact: string;
  date: string;
  startTime: string;
  endTime: string;
  rateFils: number;
  pricePerHour: number; // the same rate in AED, as stored on bookings
};

export type ValidateOptions = {
  pitchNames: readonly string[];
  openMinutes: number;
  closeMinutes: number;
  // New bookings need a contact. An existing booking that never had one (8 do) can still be edited.
  requireContact: boolean;
  // Recurring options only apply to new bookings
  allowRecurrence: boolean;
};

export type BookingFormResult =
  | { ok: true; value: BookingInput; dates: string[]; recurrence: RecurrenceType }
  | { ok: false; errors: BookingFormErrors };

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

export function validateBookingForm(values: BookingFormValues, options: ValidateOptions): BookingFormResult {
  const errors: BookingFormErrors = {};

  if (!values.pitch) errors.pitch = "Choose a pitch.";
  else if (!options.pitchNames.includes(values.pitch)) errors.pitch = "Choose one of the listed pitches.";

  const clientName = values.clientName.trim();
  if (!clientName) errors.clientName = "Enter the client's name.";
  else if (clientName.length > 100) errors.clientName = "Keep the name under 100 characters.";

  const contact = values.contact.trim();
  if (!contact && options.requireContact) errors.contact = "Enter a phone number or email.";
  else if (contact.length > 60) errors.contact = "Keep this under 60 characters.";

  if (!values.date) errors.date = "Choose a date.";
  else if (!isRealDate(values.date)) errors.date = "Enter a valid date.";

  const start = timeToMinutes(values.startTime);
  const end = timeToMinutes(values.endTime);
  if (start === null) errors.startTime = "Choose a start time.";
  if (end === null) errors.endTime = "Choose an end time.";
  if (start !== null && end !== null) {
    if (end <= start) errors.endTime = "End time must be after start time.";
    else if (start % SLOT_MINUTES !== 0 || end % SLOT_MINUTES !== 0) errors.endTime = "Use the hour or the half hour (for example 18:00 or 18:30).";
    else if (start < options.openMinutes || end > options.closeMinutes) errors.endTime = "That time is outside opening hours.";
  }

  let rateFils: number | null = null;
  if (values.rate.trim() === "") errors.rate = "Enter the price per hour.";
  else {
    rateFils = parseMajorToMinor(values.rate);
    if (rateFils === null) errors.rate = "Enter an amount like 750 or 527.10.";
    else if (rateFils > 100_000_00) errors.rate = "That price looks too high.";
  }

  const recurrence = options.allowRecurrence ? values.recurrence : "none";
  let dates = [values.date];
  if (recurrence !== "none") {
    const count = Number(values.count);
    if (!Number.isInteger(count) || count < MIN_OCCURRENCES || count > MAX_OCCURRENCES) {
      errors.count = `Enter a number from ${MIN_OCCURRENCES} to ${MAX_OCCURRENCES}.`;
    } else if (isRealDate(values.date)) {
      dates = occurrenceDates(values.date, recurrence, count);
    }
  }

  if (Object.keys(errors).length > 0 || rateFils === null) return { ok: false, errors };
  return {
    ok: true,
    value: { pitch: values.pitch, clientName, contact, date: values.date, startTime: values.startTime, endTime: values.endTime, rateFils, pricePerHour: filsToAed(rateFils) },
    dates,
    recurrence,
  };
}

// The rate field's text for an existing booking's price (527.1 -> "527.10")
export function rateText(pricePerHour: number): string {
  const fils = aedToFils(pricePerHour);
  return fils % 100 === 0 ? String(fils / 100) : (fils / 100).toFixed(2);
}
