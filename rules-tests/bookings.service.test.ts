// Tests of the real booking service (src/features/bookings/bookings.service.ts) against the emulator, with the real security
// rules switched on. They prove the double-booking guard and that existing bookings are handled safely.
//   npm run test:rules        (BACKUP_FILE=<simplified backup .json> adds the check against your real 482 bookings)
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import { collection, deleteDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { planSlotBackfill } from "../src/lib/backfill.ts";
import { conflictingDates } from "../src/lib/availability.ts";
import {
  SlotConflictError, bookingSlotKeys, cancelBooking, createBooking, createSeries, deleteBooking, fetchTakenSlots, getBooking, listBookingsForYear, listBookingsInRange, subscribeToDay, updateBooking,
  type NewBooking,
} from "../src/features/bookings/bookings.service.ts";
import { assertFails, clearFirestore, closeApps, legacyBooking, principal, seed, seedPeople, type Plain, type Principal } from "./helpers.ts";

const input = (overrides: Partial<NewBooking> = {}): NewBooking => ({
  pitch: "Fifa Pitch", clientName: "Test Client", contact: "0500000000", date: "2026-11-01", startTime: "18:00", endTime: "19:00", rateFils: 75000, pricePerHour: 750, ...overrides,
});

describe("booking service (with the real rules)", () => {
  let admin: Principal;
  let staff: Principal;
  const author = () => ({ uid: staff.uid!, name: "Staff Person" });

  before(async () => {
    admin = await principal("svc-admin", "svc-admin@test.local");
    staff = await principal("svc-staff", "svc-staff@test.local");
  });
  after(closeApps);
  beforeEach(async () => {
    await clearFirestore();
    await seedPeople(admin, staff);
  });

  const slotIds = async () => (await getDocs(collection(staff.db, "slots"))).docs.map((d) => d.id).sort();
  const bookingCount = async () => (await getDocs(collection(staff.db, "bookings"))).size;
  const rejectsWithConflict = (promise: Promise<unknown>) => assert.rejects(promise, (error) => error instanceof SlotConflictError);

  test("creating a booking writes the booking and one slot per 30 minutes, together", async () => {
    const id = await createBooking(staff.db, author(), input({ startTime: "18:00", endTime: "19:30", rateFils: 52710, pricePerHour: 527.1 }));
    const booking = (await getBooking(staff.db, id))!;
    assert.equal(booking.pitch, "Fifa Pitch");
    assert.equal(booking.hours, 1.5);
    assert.equal(booking.totalPayment, 790.65); // the same total the old system would have stored
    assert.equal(booking.status, "confirmed");
    assert.equal(booking.createdBy, staff.uid);
    assert.equal(booking.createdByName, "Staff Person");
    assert.ok(booking.createdAt instanceof Date);
    assert.deepEqual(await slotIds(), ["fifa-pitch_2026-11-01_1800", "fifa-pitch_2026-11-01_1830", "fifa-pitch_2026-11-01_1900"]);
    const slot = (await getDoc(doc(staff.db, "slots", "fifa-pitch_2026-11-01_1830"))).data();
    assert.deepEqual(slot, { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: id });
  });

  test("a clashing booking is refused and writes NOTHING", async () => {
    await createBooking(staff.db, author(), input({ startTime: "18:00", endTime: "19:30" }));
    const before = { slots: await slotIds(), bookings: await bookingCount() };
    await rejectsWithConflict(createBooking(staff.db, author(), input({ startTime: "19:00", endTime: "20:00" })));
    await rejectsWithConflict(createBooking(staff.db, author(), input({ startTime: "17:00", endTime: "18:30" })));
    await rejectsWithConflict(createBooking(staff.db, author(), input({ startTime: "18:00", endTime: "19:30" })));
    assert.deepEqual({ slots: await slotIds(), bookings: await bookingCount() }, before);
  });

  test("back-to-back bookings, other pitches and other days are all fine", async () => {
    await createBooking(staff.db, author(), input({ startTime: "18:00", endTime: "19:00" }));
    await createBooking(staff.db, author(), input({ startTime: "19:00", endTime: "20:00" })); // back to back
    await createBooking(staff.db, author(), input({ pitch: "Airdome", startTime: "18:00", endTime: "19:00" })); // other pitch
    await createBooking(staff.db, author(), input({ date: "2026-11-02", startTime: "18:00", endTime: "19:00" })); // other day
    assert.equal(await bookingCount(), 4);
    assert.equal((await slotIds()).length, 8);
  });

  test("five people booking the same slot at the same moment: exactly one wins", async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => createBooking(staff.db, author(), input({ clientName: `Client ${i}`, startTime: "18:00", endTime: "19:00" }))),
    );
    assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
    const losers = attempts.filter((a): a is PromiseRejectedResult => a.status === "rejected");
    assert.equal(losers.length, 4);
    assert.ok(losers.every((a) => a.reason instanceof SlotConflictError));
    assert.equal(await bookingCount(), 1);
    assert.equal((await slotIds()).length, 2);
  });

  test("cancelling frees the slots, keeps the booking on record, and the time can be booked again", async () => {
    const id = await createBooking(staff.db, author(), input({ startTime: "18:00", endTime: "19:00" }));
    await cancelBooking(staff.db, (await getBooking(staff.db, id))!);
    const cancelled = (await getBooking(staff.db, id))!;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.totalPayment, 750); // still on record, figures untouched
    assert.deepEqual(await slotIds(), []);
    await createBooking(staff.db, author(), input({ clientName: "Someone Else", startTime: "18:00", endTime: "19:00" }));
    assert.equal((await slotIds()).length, 2);
  });

  test("editing moves the slots, recalculates the price, and a clash leaves everything exactly as it was", async () => {
    const id = await createBooking(staff.db, author(), input({ startTime: "18:00", endTime: "19:00" }));
    await createBooking(staff.db, author(), input({ clientName: "Blocker", startTime: "20:00", endTime: "21:00" }));
    const booking = (await getBooking(staff.db, id))!;

    await updateBooking(staff.db, booking, { ...input({ startTime: "19:00", endTime: "20:00" }), rateFils: 60000, pricePerHour: 600 });
    const moved = (await getBooking(staff.db, id))!;
    assert.deepEqual([moved.startTime, moved.endTime, moved.pricePerHour, moved.totalPayment], ["19:00", "20:00", 600, 600]);
    assert.deepEqual(await slotIds(), ["fifa-pitch_2026-11-01_1900", "fifa-pitch_2026-11-01_1930", "fifa-pitch_2026-11-01_2000", "fifa-pitch_2026-11-01_2030"]);

    const snapshot = { booking: await getBooking(staff.db, id), slots: await slotIds() };
    await rejectsWithConflict(updateBooking(staff.db, moved, input({ startTime: "19:30", endTime: "20:30" }))); // runs into the Blocker
    assert.deepEqual({ booking: await getBooking(staff.db, id), slots: await slotIds() }, snapshot);
  });

  test("editing an old booking: a rename changes nothing else, a time change recalculates, nothing extra is added", async () => {
    // an old booking exactly as the legacy app wrote it, with the slots the one-time backfill would create
    await seed([
      { path: "bookings/old1", data: legacyBooking({ pricePerHour: 527.1, hours: 1.5, totalPayment: 790.65, startTime: "18:00", endTime: "19:30" }) },
      ...["1800", "1830", "1900"].map((hhmm) => ({ path: `slots/fifa-pitch_2026-11-01_${hhmm}`, data: { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "old1" } as Record<string, Plain> })),
    ]);
    const old = (await getBooking(staff.db, "old1"))!;
    const same = { pitch: old.pitch, contact: old.contact, date: old.date, startTime: old.startTime, endTime: old.endTime, rateFils: 52710, pricePerHour: 527.1 };

    await updateBooking(staff.db, old, { ...same, clientName: "Renamed Client" });
    const renamed = (await getBooking(staff.db, "old1"))!;
    assert.equal(renamed.clientName, "Renamed Client");
    assert.equal(renamed.totalPayment, 790.65);
    assert.equal(renamed.hours, 1.5);
    assert.equal(renamed.createdBy, undefined); // an old booking never gains a creator
    assert.equal(renamed.createdByName, undefined);
    assert.ok(renamed.updatedAt instanceof Date);
    assert.equal((await slotIds()).length, 3);

    await updateBooking(staff.db, renamed, { ...same, clientName: "Renamed Client", endTime: "20:00" });
    const longer = (await getBooking(staff.db, "old1"))!;
    assert.deepEqual([longer.hours, longer.totalPayment], [2, 1054.2]);
    assert.equal((await slotIds()).length, 4);
  });

  test("an old booking whose slots were never backfilled can still be edited, and gets its slots", async () => {
    await seed([{ path: "bookings/old2", data: legacyBooking({ startTime: "18:00", endTime: "19:00", hours: 1, totalPayment: 750 }) }]);
    const old = (await getBooking(staff.db, "old2"))!;
    assert.deepEqual(await slotIds(), []);
    await updateBooking(staff.db, old, { pitch: old.pitch, clientName: "Edited", contact: old.contact, date: old.date, startTime: "18:00", endTime: "19:00", rateFils: 75000, pricePerHour: 750 });
    assert.deepEqual(await slotIds(), ["fifa-pitch_2026-11-01_1800", "fifa-pitch_2026-11-01_1830"]);
  });

  test("only an admin can delete a booking, and deleting frees its slots", async () => {
    const id = await createBooking(staff.db, author(), input());
    const booking = (await getBooking(staff.db, id))!;
    await assertFails(deleteBooking(staff.db, booking));
    assert.equal(await bookingCount(), 1);
    await deleteBooking(admin.db, booking);
    assert.equal(await bookingCount(), 0);
    assert.deepEqual(await slotIds(), []);
  });

  test("a recurring series reports every date: the free ones are created, the clashing one is named", async () => {
    await createBooking(staff.db, author(), input({ date: "2026-11-08", clientName: "Already There" }));
    const result = await createSeries(staff.db, author(), input({ date: "2026-11-01" }), ["2026-11-01", "2026-11-08", "2026-11-15"]);
    assert.equal(result.created.length, 2);
    assert.deepEqual(result.failed, [{ date: "2026-11-08", reason: "already booked" }]);
    const made = await Promise.all(result.created.map((id) => getBooking(staff.db, id)));
    assert.ok(made.every((b) => b && b.seriesId && b.seriesId === made[0]!.seriesId)); // one shared series id
    assert.deepEqual(made.map((b) => b!.date).sort(), ["2026-11-01", "2026-11-15"]);
  });

  test("the availability check sees taken slots, ignores your own booking, and lists the clashing dates", async () => {
    const id = await createBooking(staff.db, author(), input({ date: "2026-11-08", startTime: "18:00", endTime: "19:00" }));
    const taken = await fetchTakenSlots(staff.db, "Fifa Pitch", ["2026-11-01", "2026-11-08", "2026-11-15"]);
    assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-01", "2026-11-08", "2026-11-15"], "18:00", "19:00"), ["2026-11-08"]);
    assert.deepEqual(conflictingDates(taken, "Fifa Pitch", ["2026-11-08"], "18:00", "19:00", id), []);
    assert.deepEqual((await fetchTakenSlots(staff.db, "Airdome", ["2026-11-08"])).size, 0);
  });

  test("listing a year returns only that year, sorted by date, and reads old bookings without extras", async () => {
    await seed([
      { path: "bookings/a", data: legacyBooking({ date: "2025-12-31" }) },
      { path: "bookings/b", data: legacyBooking({ date: "2026-01-05" }) },
      { path: "bookings/c", data: legacyBooking({ date: "2026-12-31" }) },
      { path: "bookings/d", data: legacyBooking({ date: "2027-01-01" }) },
    ]);
    const year = await listBookingsForYear(staff.db, 2026);
    assert.deepEqual(year.map((b) => b.id), ["b", "c"]);
    assert.ok(!("status" in year[0]) && !("createdBy" in year[0]));
  });

  test("a date range returns exactly the bookings between the two dates, both days included", async () => {
    await seed([
      { path: "bookings/a", data: legacyBooking({ date: "2026-10-11" }) },
      { path: "bookings/b", data: legacyBooking({ date: "2026-10-12" }) },
      { path: "bookings/c", data: legacyBooking({ date: "2026-10-18" }) },
      { path: "bookings/d", data: legacyBooking({ date: "2026-10-19" }) },
    ]);
    assert.deepEqual((await listBookingsInRange(staff.db, "2026-10-12", "2026-10-18")).map((x) => x.id), ["b", "c"]);
    assert.deepEqual((await listBookingsInRange(staff.db, "2026-10-12", "2026-10-12")).map((x) => x.id), ["b"]);
  });

  test("the live feed for one day sends the day's bookings now and every change after, until stopped", async () => {
    await seed([
      { path: "bookings/today1", data: legacyBooking({ date: "2026-11-05" }) },
      { path: "bookings/other", data: legacyBooking({ date: "2026-11-06" }) },
    ]);
    const updates: string[][] = [];
    const waitFor = async (check: () => boolean) => {
      for (let i = 0; i < 100 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(check(), "the feed did not deliver the expected update in time");
    };
    const stop = subscribeToDay(staff.db, "2026-11-05", (bookings) => updates.push(bookings.map((x) => x.id).sort()), (error) => assert.fail(error.message));
    await waitFor(() => updates.length >= 1);
    assert.deepEqual(updates.at(-1), ["today1"]); // only that day, not the booking on 6 Nov

    const id = await createBooking(staff.db, author(), input({ date: "2026-11-05", startTime: "10:00", endTime: "11:00" }));
    await waitFor(() => updates.at(-1)?.length === 2);
    assert.ok(updates.at(-1)!.includes(id)); // a new booking appears without reloading

    await cancelBooking(staff.db, (await getBooking(staff.db, id))!);
    await waitFor(() => updates.some((u) => u.length === 2) && updates.length >= 3); // the cancellation arrives too

    stop();
    const seen = updates.length;
    await createBooking(staff.db, author(), input({ date: "2026-11-05", startTime: "14:00", endTime: "15:00" }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(updates.length, seen); // nothing more arrives after stopping
  });

  // Needs a private backup, so it only runs when BACKUP_FILE points at one.
  const backupFile = process.env.BACKUP_FILE;
  test(
    "WITH YOUR REAL BOOKINGS: the guard covers every existing booking, and editing and cancelling them is safe",
    { skip: backupFile && existsSync(backupFile) ? false : "set BACKUP_FILE to a simplified backup to run this" },
    async () => {
      const real = JSON.parse(readFileSync(backupFile!, "utf-8")) as ({ id: string } & Record<string, Plain>)[];
      await seed(real.map(({ id, ...data }) => ({ path: `bookings/${id}`, data })));
      const plan = planSlotBackfill(real as unknown as Parameters<typeof planSlotBackfill>[0]);
      assert.equal(plan.collisions.length, 0);
      await seed(plan.slots.map((slot) => ({ path: `slots/${slot.id}`, data: { pitch: slot.pitch, date: slot.date, bookingId: slot.bookingId } })));

      // every real booking really blocks its own time
      const sample = real.filter((b) => String(b.date) >= "2026-10-11").slice(0, 25);
      assert.ok(sample.length > 0);
      for (const b of sample) {
        await rejectsWithConflict(createBooking(staff.db, author(), input({ pitch: String(b.pitch), date: String(b.date), startTime: String(b.startTime), endTime: String(b.endTime) })));
      }

      // edit a real booking: the rename touches nothing else
      const target = (await getBooking(staff.db, sample[0].id))!;
      const rateFils = Math.round(target.pricePerHour * 100);
      const unchanged = { pitch: target.pitch, contact: target.contact, date: target.date, startTime: target.startTime, endTime: target.endTime, rateFils, pricePerHour: target.pricePerHour };
      await updateBooking(staff.db, target, { ...unchanged, clientName: "Renamed In Test" });
      const edited = (await getBooking(staff.db, target.id))!;
      assert.deepEqual([edited.hours, edited.totalPayment, edited.pricePerHour, edited.date, edited.startTime], [target.hours, target.totalPayment, target.pricePerHour, target.date, target.startTime]);

      // cancel it: its time opens up, and can be booked again
      await cancelBooking(staff.db, edited);
      const again = await createBooking(staff.db, author(), input({ pitch: target.pitch, date: target.date, startTime: target.startTime, endTime: target.endTime }));
      assert.ok(again);
      assert.equal((await getBooking(staff.db, target.id))!.status, "cancelled");
      // and the other real bookings are untouched
      assert.equal((await getDocs(collection(staff.db, "bookings"))).size, real.length + 1);
      await deleteDoc(doc(admin.db, "bookings", again)).catch(() => undefined);
    },
  );

  test("bookingSlotKeys matches the keys the backfill creates", () => {
    assert.deepEqual(bookingSlotKeys({ pitch: "Junior Football Pitch", date: "2026-11-01", startTime: "09:30", endTime: "10:30" }), ["junior-football-pitch_2026-11-01_0930", "junior-football-pitch_2026-11-01_1000"]);
    assert.deepEqual(bookingSlotKeys({ pitch: "Fifa Pitch", date: "2026-11-01", startTime: "bad", endTime: "10:30" }), []);
  });
});
