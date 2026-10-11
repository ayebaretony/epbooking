// Fills the practice EMULATOR with your real bookings (from a backup file), the pitches, the slot documents and two fake
// test users, so the new app can be built and tried on realistic data. EMULATOR ONLY: it has no way to target production.
//
//   npm run emulators                                   (in another terminal)
//   node scripts/seed_emulator.ts --backup /path/to/bookings-….json
//   add --reset to wipe the emulator's data first
//
// The backup is the simplified .json made by scripts/backup_bookings.py (not the .raw.json). It contains client personal
// data, so it stays out of git (backups/ is git-ignored).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { BackfillBooking } from "../src/lib/backfill.ts";
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

  // Fake sign-in accounts, only inside the emulator
  for (const extra of [[], ["--role", "staff"]]) execFileSync("node", ["scripts/seed_emulator_user.mjs", ...extra], { stdio: "inherit" });
  console.log(report.ok ? "\nAll set. Run `npm run dev` and sign in with the test admin above." : "\nSeeded, but the backfill reported problems (see above).");
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
