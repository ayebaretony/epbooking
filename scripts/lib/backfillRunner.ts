import { planSlotBackfill, seedPitchesFromBookings, type BackfillBooking } from "../../src/lib/backfill.ts";
import { createOnly, listCollection, type Target } from "./firestoreRest.ts";

export type BackfillReport = { ok: boolean; created: { slots: number; pitches: number } };

// Plans the slot and pitch documents for `bookings`, compares with what the target already has, prints a report, and
// (only when `apply` is true) creates the missing documents and verifies them. It never writes to `bookings`.
export async function runBackfill(target: Target, bookings: BackfillBooking[], apply: boolean): Promise<BackfillReport> {
  const plan = planSlotBackfill(bookings);
  const pitchSeeds = seedPitchesFromBookings(bookings);

  const existingSlots = new Map((await listCollection(target, "slots")).map((doc) => [doc.id, doc.data.bookingId]));
  const existingPitches = new Set((await listCollection(target, "pitches")).map((doc) => doc.id));

  const slotsToCreate = plan.slots.filter((slot) => !existingSlots.has(slot.id));
  const slotsThatDiffer = plan.slots.filter((slot) => existingSlots.has(slot.id) && existingSlots.get(slot.id) !== slot.bookingId);
  const pitchesToCreate = pitchSeeds.filter((pitch) => !existingPitches.has(pitch.id));

  console.log(`\nBookings read:                  ${bookings.length}`);
  console.log(`Slots the bookings need:        ${plan.expectedSlotCount}`);
  console.log(`Slots planned (one per slot):   ${plan.slots.length}`);
  console.log(`  already in ${target.name}:${" ".repeat(Math.max(1, 17 - target.name.length))}${plan.slots.length - slotsToCreate.length}`);
  console.log(`  to create:                    ${slotsToCreate.length}`);
  console.log(`Clashes (two bookings, one slot): ${plan.collisions.length}`);
  for (const c of plan.collisions.slice(0, 10)) console.log(`  ${c.slotId}: bookings ${c.bookingIds.join(", ")}`);
  console.log(`Existing slots owned by a different booking: ${slotsThatDiffer.length}`);
  console.log(`Bookings with no slots:         ${plan.skipped.length}`);
  for (const s of plan.skipped.slice(0, 10)) console.log(`  ${s.bookingId}: ${s.reason}`);
  console.log(`Pitches: ${pitchSeeds.length} found on bookings, ${pitchesToCreate.length} to create`);
  for (const p of pitchSeeds) console.log(`  ${p.name.padEnd(24)} colour ${p.color}, no price set${existingPitches.has(p.id) ? "  (already exists)" : ""}`);

  const problems = plan.collisions.length + slotsThatDiffer.length + plan.skipped.length;
  if (!apply) {
    console.log(`\nDRY RUN: nothing was written to ${target.name}. Add --apply to create ${slotsToCreate.length} slots and ${pitchesToCreate.length} pitches.`);
    return { ok: problems === 0, created: { slots: 0, pitches: 0 } };
  }

  await createOnly(target, "pitches", pitchesToCreate.map((p) => ({ id: p.id, data: { name: p.name, description: p.description, color: p.color, sortOrder: p.sortOrder, archived: false } })));
  await createOnly(target, "slots", slotsToCreate.map((s) => ({ id: s.id, data: { pitch: s.pitch, date: s.date, bookingId: s.bookingId } })));

  // Verify: every planned slot exists and belongs to the right booking, and every pitch exists
  const afterSlots = new Map((await listCollection(target, "slots")).map((doc) => [doc.id, doc.data.bookingId]));
  const afterPitches = new Set((await listCollection(target, "pitches")).map((doc) => doc.id));
  const missing = plan.slots.filter((slot) => afterSlots.get(slot.id) !== slot.bookingId).length;
  const missingPitches = pitchSeeds.filter((pitch) => !afterPitches.has(pitch.id)).length;
  const verified = missing === 0 && missingPitches === 0;
  console.log(`\nAPPLIED to ${target.name}: created ${slotsToCreate.length} slots and ${pitchesToCreate.length} pitches.`);
  console.log(verified ? `VERIFIED: all ${plan.slots.length} slots and ${pitchSeeds.length} pitches are present and correct.` : `VERIFY FAILED: ${missing} slots and ${missingPitches} pitches are missing or wrong.`);
  return { ok: verified && problems === 0, created: { slots: slotsToCreate.length, pitches: pitchesToCreate.length } };
}
