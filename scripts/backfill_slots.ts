// One-time, additive setup for the new app: creates a slot document for every existing booking (the double-booking guard)
// and seeds the pitches. It READS bookings and WRITES ONLY to `slots` and `pitches`. It never changes a booking.
//
//   node scripts/backfill_slots.ts                      dry run against the EMULATOR (reads the emulator's bookings)
//   node scripts/backfill_slots.ts --backup FILE        dry run, using bookings from a backup file
//   node scripts/backfill_slots.ts --apply              create the documents in the EMULATOR
//   node scripts/backfill_slots.ts --production         dry run against the LIVE project (read-only)
//   node scripts/backfill_slots.ts --production --apply --confirm-production
//                                                       create them in the LIVE project (only with the owner's go-ahead,
//                                                       and BEFORE the new security rules are deployed)
//
// Safe to run twice: documents that already exist are skipped, never overwritten.
import { readFileSync } from "node:fs";
import type { BackfillBooking } from "../src/lib/backfill.ts";
import { EMULATOR, PRODUCTION, listCollection } from "./lib/firestoreRest.ts";
import { runBackfill } from "./lib/backfillRunner.ts";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);

const production = has("--production");
const apply = has("--apply");
const target = production ? PRODUCTION : EMULATOR;

if (production && apply && !has("--confirm-production")) {
  console.error("Refusing to write to the LIVE project without --confirm-production (and the owner's go-ahead in chat).");
  process.exit(1);
}

console.log(`TARGET: ${production ? "PRODUCTION (the live project)" : "emulator"}   MODE: ${apply ? "APPLY" : "dry run"}`);

const backupFile = value("--backup");
let bookings: BackfillBooking[];
if (backupFile) {
  const rows = JSON.parse(readFileSync(backupFile, "utf-8")) as Record<string, unknown>[];
  bookings = rows.map((row) => ({ id: String(row.id), pitch: String(row.pitch), date: String(row.date), startTime: String(row.startTime), endTime: String(row.endTime), status: typeof row.status === "string" ? row.status : undefined }));
  console.log(`Bookings from backup file: ${backupFile}`);
} else {
  const docs = await listCollection(target, "bookings");
  bookings = docs.map(({ id, data }) => ({ id, pitch: String(data.pitch), date: String(data.date), startTime: String(data.startTime), endTime: String(data.endTime), status: typeof data.status === "string" ? data.status : undefined }));
  console.log(`Bookings read from ${target.name}`);
}

try {
  const report = await runBackfill(target, bookings, apply);
  process.exit(report.ok ? 0 : 2);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
