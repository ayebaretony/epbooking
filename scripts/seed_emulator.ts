// Fills the practice EMULATOR with your real bookings (from a backup file), the pitches, the slot documents and two fake
// test users, so the new app can be built and tried on realistic data. EMULATOR ONLY: it has no way to target production.
//
//   npm run emulators                                   (in another terminal)
//   node scripts/seed_emulator.ts --backup /path/to/bookings-….json
//   add --reset to wipe the emulator's data first
//   add --demo-today to also add a few FAKE bookings dated today, so the Today screen has something to show
//
// The backup is the simplified .json made by scripts/backup_bookings.py (not the .raw.json). It contains client personal
// data, so it stays out of git (backups/ is git-ignored).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { BackfillBooking } from "../src/lib/backfill.ts";
import { pitchSlug, slotKeysFor } from "../src/lib/conflicts.ts";
import { timeToMinutes } from "../src/lib/bookingMath.ts";
import { todayInTimezone } from "../src/lib/time.ts";
import { EMULATOR, clearEmulator, createOnly, listCollection, type Plain } from "./lib/firestoreRest.ts";
import { runBackfill } from "./lib/backfillRunner.ts";

const args = process.argv.slice(2);
const backupFile = args.includes("--backup") ? args[args.indexOf("--backup") + 1] : process.env.BACKUP_FILE;
if (!backupFile) {
  console.error("Usage: node scripts/seed_emulator.ts --backup /path/to/bookings-….json [--reset]");
  process.exit(1);
}

try {
  if (args.includes("--reset")) {
    await clearEmulator();
    console.log("Emulator data cleared.");
  }

  const rows = JSON.parse(readFileSync(backupFile, "utf-8")) as ({ id: string } & Record<string, Plain>)[];
  const existing = new Set((await listCollection(EMULATOR, "bookings")).map((doc) => doc.id));
  const toLoad = rows.filter((row) => !existing.has(row.id)).map(({ id, ...data }) => ({ id, data }));
  await createOnly(EMULATOR, "bookings", toLoad);
  console.log(`Bookings: loaded ${toLoad.length} into the emulator (${existing.size} were already there).`);

  const bookings: BackfillBooking[] = rows.map((row) => ({ id: row.id, pitch: String(row.pitch), date: String(row.date), startTime: String(row.startTime), endTime: String(row.endTime) }));
  const report = await runBackfill(EMULATOR, bookings, true);

  if (args.includes("--demo-today")) {
    const today = todayInTimezone("Asia/Dubai");
    const demo = [
      ["Fifa Pitch", "Demo Client A", "17:00", "19:00", 750],
      ["Fifa Pitch", "Demo Client B", "21:00", "22:30", 600],
      ["Airdome", "Demo Client C", "20:30", "21:30", 400],
      ["Junior Football Pitch", "Demo Client D", "18:00", "19:30", 440],
      ["Half Pitch", "Demo Client E", "07:00", "08:00", 500],
    ] as const;
    const taken = new Set((await listCollection(EMULATOR, "slots")).map((doc) => doc.id));
    const bookingsToAdd = [];
    const slotsToAdd = [];
    for (const [index, [pitch, clientName, startTime, endTime, price]] of demo.entries()) {
      const keys = slotKeysFor(pitchSlug(pitch), today, timeToMinutes(startTime)!, timeToMinutes(endTime)!, 30);
      if (keys.some((key) => taken.has(key))) continue; // never overlap a real booking
      const id = `demo-today-${index}`;
      const hours = (timeToMinutes(endTime)! - timeToMinutes(startTime)!) / 60;
      bookingsToAdd.push({ id, data: { pitch, clientName, contact: "0500000000", date: today, startTime, endTime, pricePerHour: price, hours, totalPayment: hours * price } });
      for (const key of keys) slotsToAdd.push({ id: key, data: { pitch, date: today, bookingId: id } });
    }
    await createOnly(EMULATOR, "bookings", bookingsToAdd.filter((b) => !existing.has(b.id)));
    await createOnly(EMULATOR, "slots", slotsToAdd.filter((slot) => !taken.has(slot.id)));
    console.log(`Demo: added ${bookingsToAdd.length} fake bookings dated ${today}.`);
  }

  // Fake sign-in accounts, only inside the emulator
  for (const extra of [[], ["--role", "staff"]]) execFileSync("node", ["scripts/seed_emulator_user.mjs", ...extra], { stdio: "inherit" });
  console.log(report.ok ? "\nAll set. Run `npm run dev` and sign in with the test admin above." : "\nSeeded, but the backfill reported problems (see above).");
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
