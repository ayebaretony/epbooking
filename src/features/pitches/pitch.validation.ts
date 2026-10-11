// Relative .ts imports (not "@/"), so this file can also be run by `npm test` without a bundler.
import { pitchSlug } from "../../lib/conflicts.ts";
import { filsToAed, parseMajorToMinor } from "../../lib/money.ts";
import { isPitchColorKey, type PitchColorKey } from "../../lib/pitchColors.ts";

export type PitchFormValues = { name: string; description: string; rate: string; color: string };
export type PitchFormErrors = Partial<Record<keyof PitchFormValues, string>>;

// What gets saved. `defaultRatePerHour` is null when the price is left empty: pitches have no fixed price (each client's
// rate is negotiated), so "Not set" is the normal state and every booking types its own rate.
export type PitchInput = { name: string; description: string; defaultRatePerHour: number | null; color: PitchColorKey };

export type PitchFormResult = { ok: true; value: PitchInput } | { ok: false; errors: PitchFormErrors };

// `existingSlugs` are the ids of pitches that already exist. A name can't be reused, and a saved pitch's name never changes,
// because old bookings refer to pitches by name.
export function validatePitchForm(values: PitchFormValues, existingSlugs: readonly string[], editing: boolean): PitchFormResult {
  const errors: PitchFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = "Enter the pitch name.";
  else if (name.length > 60) errors.name = "Keep the name under 60 characters.";
  else if (!pitchSlug(name)) errors.name = "Use letters or numbers in the name.";
  else if (!editing && existingSlugs.includes(pitchSlug(name))) errors.name = "A pitch with this name already exists.";

  const description = values.description.trim();
  if (description.length > 100) errors.description = "Keep this under 100 characters.";

  let defaultRatePerHour: number | null = null;
  if (values.rate.trim() !== "") {
    const fils = parseMajorToMinor(values.rate);
    if (fils === null) errors.rate = "Enter an amount like 750 or 527.10, or leave it empty.";
    else defaultRatePerHour = filsToAed(fils);
  }

  if (!isPitchColorKey(values.color)) errors.color = "Choose a colour.";

  if (Object.keys(errors).length > 0 || !isPitchColorKey(values.color)) return { ok: false, errors };
  return { ok: true, value: { name, description, defaultRatePerHour, color: values.color } };
}
