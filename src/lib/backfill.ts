// Plans the one-time, additive setup that the new app needs on top of the EXISTING bookings (AGENTS.md section 5):
//  - one slot document per occupied 30-minute slot (the double-booking guard), and
//  - the four pitch documents, seeded from the pitch names already on the bookings.
// This file only COMPUTES the plan from plain data. It reads and writes nothing, so it is easy to test.
// Bookings are never changed: the plan only ever describes new `slots` and `pitches` documents.
import { nextUnusedColor, type PitchColorKey } from "./pitchColors.ts";
import { pitchSlug, slotKeysFor } from "./conflicts.ts";

export type BackfillBooking = {
  id: string;
  pitch: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
};

export type PlannedSlot = { id: string; pitch: string; date: string; bookingId: string };

export type BackfillPlan = {
  slots: PlannedSlot[];
  // Two bookings wanting the same slot. The first keeps it, and the rest are reported so a person can look.
  collisions: { slotId: string; bookingIds: string[] }[];
  // Bookings that do not occupy slots, with the reason: cancelled, or times that don't fit the slot grid
  skipped: { bookingId: string; reason: string }[];
  // How many slots the bookings should need in total, to check the result against
  expectedSlotCount: number;
};

function minutesOf(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function planSlotBackfill(bookings: readonly BackfillBooking[], slotMinutes = 30): BackfillPlan {
  const slots = new Map<string, PlannedSlot>();
  const collisions = new Map<string, string[]>();
  const skipped: BackfillPlan["skipped"] = [];
  let expectedSlotCount = 0;

  for (const booking of bookings) {
    if (booking.status === "cancelled") {
      skipped.push({ bookingId: booking.id, reason: "cancelled" });
      continue;
    }
    const start = minutesOf(booking.startTime);
    const end = minutesOf(booking.endTime);
    if (start === null || end === null || end <= start) {
      skipped.push({ bookingId: booking.id, reason: "invalid times" });
      continue;
    }
    if (start % slotMinutes !== 0 || end % slotMinutes !== 0) {
      skipped.push({ bookingId: booking.id, reason: `times are not on the ${slotMinutes}-minute grid` });
      continue;
    }

    const keys = slotKeysFor(pitchSlug(booking.pitch), booking.date, start, end, slotMinutes);
    expectedSlotCount += keys.length;
    for (const id of keys) {
      const existing = slots.get(id);
      if (existing) {
        collisions.set(id, [...(collisions.get(id) ?? [existing.bookingId]), booking.id]);
      } else {
        slots.set(id, { id, pitch: booking.pitch, date: booking.date, bookingId: booking.id });
      }
    }
  }

  return {
    slots: [...slots.values()],
    collisions: [...collisions].map(([slotId, bookingIds]) => ({ slotId, bookingIds })),
    skipped,
    expectedSlotCount,
  };
}

export type PitchSeed = {
  id: string; // pitchSlug
  name: string; // exactly as stored on the bookings
  description: string;
  color: PitchColorKey;
  sortOrder: number;
  archived: false;
};

// Description, colour and order for the four pitches in the owner's designs. Any other pitch name found on bookings
// gets an empty description and the next unused colour.
const KNOWN_PITCHES: Record<string, { description: string; color: PitchColorKey; sortOrder: number }> = {
  "Fifa Pitch": { description: "11-a-side", color: "green", sortOrder: 1 },
  Airdome: { description: "Indoor pitch", color: "blue", sortOrder: 2 },
  "Junior Football Pitch": { description: "Training pitch", color: "amber", sortOrder: 3 },
  "Half Pitch": { description: "5-a-side", color: "purple", sortOrder: 4 },
};

// Pitches carry NO price: each client's rate is negotiated, so every booking stores its own pricePerHour. A pitch may
// get an optional default rate later (Settings), which only prefills the form, so none is seeded here.
export function seedPitchesFromBookings(bookings: readonly BackfillBooking[]): PitchSeed[] {
  const names = [...new Set(bookings.map((booking) => booking.pitch))].sort((a, b) => {
    const orderA = KNOWN_PITCHES[a]?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = KNOWN_PITCHES[b]?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.localeCompare(b);
  });

  const usedColors: string[] = [];
  return names.map((name, index) => {
    const known = KNOWN_PITCHES[name];
    const color = known?.color ?? nextUnusedColor(usedColors);
    usedColors.push(color);
    return {
      id: pitchSlug(name),
      name,
      description: known?.description ?? "",
      color,
      sortOrder: known?.sortOrder ?? index + 1,
      archived: false,
    };
  });
}
