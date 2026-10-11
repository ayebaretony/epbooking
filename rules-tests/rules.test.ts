// Security-rules tests. They run against the Firebase EMULATORS only (fake project "demo-epbooking"), never production:
//   npm run test:rules
// Uses the Firebase client SDK that the app already depends on, so no extra package is needed.
//
// Optional extra check: set BACKUP_FILE to a backup made by scripts/backup_bookings.py (simplified .json, not .raw.json)
// and every real booking in it is loaded into the emulator and must still be editable under these rules.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

// The SDK logs every denial it receives; the tests expect many, so keep the output readable.
setLogLevel("silent");

const PROJECT = "demo-epbooking";
const FIRESTORE = "http://127.0.0.1:8080";
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;

// ---------- emulator helpers ----------

type Plain = string | number | boolean | null | Date;

function toValue(v: Plain) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
}

// Writes documents as the emulator's admin ("owner" token bypasses the rules), to set up test data.
async function seed(docs: { path: string; data: Record<string, Plain> }[]) {
  for (let i = 0; i < docs.length; i += 200) {
    const writes = docs.slice(i, i + 200).map(({ path, data }) => ({
      update: {
        name: `projects/${PROJECT}/databases/(default)/documents/${path}`,
        fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])),
      },
    }));
    const res = await fetch(`${DOCS}:commit`, {
      method: "POST",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ writes }),
    });
    assert.equal(res.status, 200, await res.text());
  }
}

async function clearFirestore() {
  const res = await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(res.status, 200);
}

async function assertSucceeds(promise: Promise<unknown>) {
  await promise;
}

async function assertFails(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: { code?: string }) => error.code === "permission-denied");
}

type Principal = { db: Firestore; uid: string | null };
const apps: FirebaseApp[] = [];

// A signed-in person (or nobody, when email is null) as seen by Firestore.
async function principal(name: string, email: string | null): Promise<Principal> {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, name);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  if (email === null) return { db, uid: null };
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const { user } = await createUserWithEmailAndPassword(auth, email, "test-password-123");
  return { db, uid: user.uid };
}

// ---------- test data ----------

// A booking exactly as the existing system stored them: the nine original fields only.
const legacyBooking = (overrides: Record<string, Plain> = {}) => ({
  pitch: "Fifa Pitch",
  clientName: "Test Client",
  contact: "0500000000",
  date: "2026-11-01",
  startTime: "18:00",
  endTime: "20:00",
  pricePerHour: 750,
  hours: 2,
  totalPayment: 1500,
  ...overrides,
});

// A booking as the new app writes it: the nine fields plus the optional additive ones.
const newBooking = (uid: string, overrides: Record<string, unknown> = {}) => ({
  ...legacyBooking(),
  status: "confirmed",
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...overrides,
});

const pitch = (overrides: Record<string, Plain> = {}) => ({
  name: "Fifa Pitch",
  description: "11-a-side",
  color: "green",
  sortOrder: 1,
  archived: false,
  ...overrides,
});

// ---------- tests ----------

describe("firestore.rules", () => {
  let admin: Principal;
  let staff: Principal;
  let inactive: Principal;
  let noProfile: Principal;
  let anonymous: Principal;

  before(async () => {
    admin = await principal("admin", "admin@test.local");
    staff = await principal("staff", "staff@test.local");
    inactive = await principal("inactive", "inactive@test.local");
    noProfile = await principal("noprofile", "noprofile@test.local");
    anonymous = await principal("anonymous", null);
  });

  after(async () => {
    await Promise.all(apps.map((app) => deleteApp(app)));
  });

  beforeEach(async () => {
    await clearFirestore();
    const now = new Date();
    await seed([
      { path: `users/${admin.uid}`, data: { displayName: "Admin", email: "admin@test.local", role: "admin", active: true, createdAt: now } },
      { path: `users/${staff.uid}`, data: { displayName: "Staff", email: "staff@test.local", role: "staff", active: true, createdAt: now } },
      { path: `users/${inactive.uid}`, data: { displayName: "Inactive", email: "inactive@test.local", role: "staff", active: false, createdAt: now } },
      { path: "bookings/old1", data: legacyBooking() },
    ]);
  });

  describe("access", () => {
    test("nobody who is signed out can read or write anything", async () => {
      await assertFails(getDoc(doc(anonymous.db, "bookings/old1")));
      await assertFails(getDocs(collection(anonymous.db, "bookings")));
      await assertFails(setDoc(doc(anonymous.db, "bookings/x"), legacyBooking()));
      await assertFails(deleteDoc(doc(anonymous.db, "bookings/old1")));
    });

    test("signing up alone grants nothing: no users document, or an inactive one, is locked out", async () => {
      for (const person of [noProfile, inactive]) {
        await assertFails(getDoc(doc(person.db, "bookings/old1")));
        await assertFails(getDocs(collection(person.db, "bookings")));
        await assertFails(setDoc(doc(person.db, "bookings/x"), newBooking(person.uid!)));
        await assertFails(getDocs(collection(person.db, "pitches")));
      }
    });

    test("anything outside the known collections is denied, even for an admin", async () => {
      await assertFails(setDoc(doc(admin.db, "settings/center"), { a: 1 }));
      await assertFails(getDoc(doc(admin.db, "settings/center")));
      await assertFails(setDoc(doc(admin.db, "blocks/b1"), { a: 1 }));
    });

    test("a person can read their own profile but not someone else's", async () => {
      await assertSucceeds(getDoc(doc(noProfile.db, `users/${noProfile.uid}`)).catch(() => undefined)); // no doc yet: reading is allowed
      await assertSucceeds(getDoc(doc(inactive.db, `users/${inactive.uid}`)));
      await assertFails(getDoc(doc(inactive.db, `users/${staff.uid}`)));
      await assertFails(getDoc(doc(staff.db, `users/${admin.uid}`)));
      await assertSucceeds(getDoc(doc(admin.db, `users/${staff.uid}`)));
    });
  });

  describe("bookings", () => {
    test("active staff can read existing bookings", async () => {
      await assertSucceeds(getDoc(doc(staff.db, "bookings/old1")));
      await assertSucceeds(getDocs(collection(staff.db, "bookings")));
    });

    test("staff can create a valid booking with the optional extra fields", async () => {
      await assertSucceeds(setDoc(doc(staff.db, "bookings/new1"), newBooking(staff.uid!)));
      await assertSucceeds(setDoc(doc(staff.db, "bookings/new2"), newBooking(staff.uid!, { notes: "Birthday", seriesId: "series-1" })));
    });

    test("a new booking must record who made it, and the server's clock", async () => {
      await assertFails(setDoc(doc(staff.db, "bookings/n"), legacyBooking())); // no createdBy/createdAt/updatedAt
      await assertFails(setDoc(doc(staff.db, "bookings/n"), newBooking(admin.uid!))); // someone else's name
      await assertFails(setDoc(doc(staff.db, "bookings/n"), newBooking(staff.uid!, { createdAt: new Date("2020-01-01") })));
    });

    test("invalid bookings are rejected", async () => {
      const bad: Record<string, unknown>[] = [
        { endTime: "18:00" }, // ends when it starts
        { endTime: "17:00", hours: 1, totalPayment: 750 }, // ends before it starts
        { startTime: "6pm" }, // not HH:mm
        { startTime: "24:00", endTime: "25:00" },
        { date: "01/11/2026" },
        { date: "2026-11-1" },
        { pricePerHour: -5, totalPayment: -10 },
        { totalPayment: 900 }, // does not equal hours x rate
        { hours: 0, totalPayment: 0 },
        { clientName: "" },
        { pitch: "" },
        { contact: 12345 },
        { status: "done" },
        { notes: "x".repeat(501) },
        { surprise: "extra field" },
      ];
      for (const override of bad) {
        await assertFails(setDoc(doc(staff.db, "bookings/bad"), newBooking(staff.uid!, override)));
      }
    });

    test("a booking with an empty contact is fine (8 existing bookings have none)", async () => {
      await assertSucceeds(setDoc(doc(staff.db, "bookings/nocontact"), newBooking(staff.uid!, { contact: "" })));
    });

    test("staff can edit and cancel an OLD booking that has none of the optional fields", async () => {
      await assertSucceeds(updateDoc(doc(staff.db, "bookings/old1"), { status: "cancelled", updatedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(doc(staff.db, "bookings/old1"), { clientName: "Renamed", updatedAt: serverTimestamp() }));
      const edited = (await getDoc(doc(staff.db, "bookings/old1"))).data()!;
      assert.equal(edited.pitch, "Fifa Pitch"); // untouched fields keep their stored values and format
      assert.equal(edited.date, "2026-11-01");
      assert.equal(edited.totalPayment, 1500);
    });

    test("an edit must stamp updatedAt with the server clock and keep totals consistent", async () => {
      await assertFails(updateDoc(doc(staff.db, "bookings/old1"), { status: "cancelled" })); // no updatedAt
      await assertFails(updateDoc(doc(staff.db, "bookings/old1"), { updatedAt: new Date("2020-01-01") }));
      await assertFails(updateDoc(doc(staff.db, "bookings/old1"), { pricePerHour: 900, updatedAt: serverTimestamp() })); // total no longer matches
      await assertSucceeds(updateDoc(doc(staff.db, "bookings/old1"), { pricePerHour: 900, totalPayment: 1800, updatedAt: serverTimestamp() }));
    });

    test("who created a booking, and when, can never be changed or added later", async () => {
      await setDoc(doc(staff.db, "bookings/mine"), newBooking(staff.uid!));
      await assertFails(updateDoc(doc(staff.db, "bookings/mine"), { createdBy: admin.uid, updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(staff.db, "bookings/mine"), { createdAt: new Date("2020-01-01"), updatedAt: serverTimestamp() }));
      await assertFails(updateDoc(doc(staff.db, "bookings/old1"), { createdBy: staff.uid, updatedAt: serverTimestamp() })); // old booking can't gain it
    });

    test("only an admin can delete a booking", async () => {
      await assertFails(deleteDoc(doc(staff.db, "bookings/old1")));
      await assertSucceeds(deleteDoc(doc(admin.db, "bookings/old1")));
    });
  });

  describe("slots (the double-booking guard)", () => {
    test("a booking and its slots can be created together", async () => {
      const batch = writeBatch(staff.db);
      batch.set(doc(staff.db, "bookings/b1"), newBooking(staff.uid!));
      for (const hhmm of ["1800", "1830", "1900", "1930"]) {
        batch.set(doc(staff.db, `slots/fifa-pitch_2026-11-01_${hhmm}`), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "b1" });
      }
      await assertSucceeds(batch.commit());
    });

    test("a second booking for the same pitch and time cannot take an occupied slot", async () => {
      await seed([
        { path: "bookings/b1", data: legacyBooking() },
        { path: "slots/fifa-pitch_2026-11-01_1800", data: { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "b1" } },
      ]);
      const batch = writeBatch(staff.db);
      batch.set(doc(staff.db, "bookings/b2"), newBooking(staff.uid!));
      batch.set(doc(staff.db, "slots/fifa-pitch_2026-11-01_1800"), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "b2" });
      await assertFails(batch.commit());
      // and nobody can overwrite it directly either (there is no update rule)
      await assertFails(setDoc(doc(staff.db, "slots/fifa-pitch_2026-11-01_1800"), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "b1" }));
    });

    test("different pitches at the same time do not clash", async () => {
      await seed([
        { path: "bookings/b1", data: legacyBooking() },
        { path: "slots/fifa-pitch_2026-11-01_1800", data: { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "b1" } },
      ]);
      const batch = writeBatch(staff.db);
      batch.set(doc(staff.db, "bookings/b2"), newBooking(staff.uid!, { pitch: "Airdome", pricePerHour: 400, totalPayment: 800 }));
      batch.set(doc(staff.db, "slots/airdome_2026-11-01_1800"), { pitch: "Airdome", date: "2026-11-01", bookingId: "b2" });
      await assertSucceeds(batch.commit());
    });

    test("a slot must belong to a booking that exists, and be well-formed", async () => {
      await assertFails(setDoc(doc(staff.db, "slots/fifa-pitch_2026-11-01_1800"), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "ghost" }));
      await assertFails(setDoc(doc(staff.db, "slots/wrong-id"), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "old1" }));
      await assertFails(setDoc(doc(staff.db, "slots/fifa-pitch_2026-11-02_1800"), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "old1" })); // date mismatch
      await assertFails(setDoc(doc(staff.db, "slots/fifa-pitch_2026-11-01_1800"), { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "old1", extra: 1 }));
    });

    test("cancelling frees the slots", async () => {
      await seed([{ path: "slots/fifa-pitch_2026-11-01_1800", data: { pitch: "Fifa Pitch", date: "2026-11-01", bookingId: "old1" } }]);
      await assertSucceeds(deleteDoc(doc(staff.db, "slots/fifa-pitch_2026-11-01_1800")));
      await assertFails(deleteDoc(doc(anonymous.db, "slots/fifa-pitch_2026-11-01_1800")));
    });
  });

  describe("pitches", () => {
    test("everyone active can read pitches, only an admin can change them", async () => {
      await seed([{ path: "pitches/fifa-pitch", data: pitch() }]);
      await assertSucceeds(getDoc(doc(staff.db, "pitches/fifa-pitch")));
      await assertFails(setDoc(doc(staff.db, "pitches/airdome"), pitch({ name: "Airdome" })));
      await assertSucceeds(setDoc(doc(admin.db, "pitches/airdome"), pitch({ name: "Airdome" })));
      await assertSucceeds(updateDoc(doc(admin.db, "pitches/fifa-pitch"), { defaultRatePerHour: 800 })); // optional, can be added later
    });

    test("a pitch can never be renamed or deleted (old bookings refer to it by name)", async () => {
      await seed([{ path: "pitches/fifa-pitch", data: pitch() }]);
      await assertFails(updateDoc(doc(admin.db, "pitches/fifa-pitch"), { name: "Fifa Pitch 2" }));
      await assertFails(deleteDoc(doc(admin.db, "pitches/fifa-pitch")));
      await assertSucceeds(updateDoc(doc(admin.db, "pitches/fifa-pitch"), { archived: true }));
    });

    test("a pitch needs no price (each client's rate is negotiated), but any price given must be valid", async () => {
      await assertSucceeds(setDoc(doc(admin.db, "pitches/no-price"), pitch({ name: "No Price Pitch" })));
      await assertSucceeds(setDoc(doc(admin.db, "pitches/priced"), pitch({ name: "Priced Pitch", defaultRatePerHour: 600 })));
    });

    test("pitch data is validated", async () => {
      await assertFails(setDoc(doc(admin.db, "pitches/x"), pitch({ defaultRatePerHour: -1 })));
      await assertFails(setDoc(doc(admin.db, "pitches/x"), pitch({ defaultRatePerHour: "free" })));
      await assertFails(setDoc(doc(admin.db, "pitches/x"), pitch({ extra: "no" })));
    });
  });

  describe("users", () => {
    test("nobody can create or delete users from the app, not even an admin", async () => {
      await assertFails(setDoc(doc(noProfile.db, `users/${noProfile.uid}`), { displayName: "Me", email: "noprofile@test.local", role: "admin", active: true, createdAt: serverTimestamp() }));
      await assertFails(setDoc(doc(admin.db, "users/someone"), { displayName: "X", email: "x@test.local", role: "staff", active: true, createdAt: serverTimestamp() }));
      await assertFails(deleteDoc(doc(admin.db, `users/${staff.uid}`)));
    });

    test("a person can change only their own display name, never their role or active flag", async () => {
      await assertSucceeds(updateDoc(doc(staff.db, `users/${staff.uid}`), { displayName: "New Name" }));
      await assertFails(updateDoc(doc(staff.db, `users/${staff.uid}`), { displayName: "" }));
      await assertFails(updateDoc(doc(staff.db, `users/${staff.uid}`), { role: "admin" }));
      await assertFails(updateDoc(doc(staff.db, `users/${staff.uid}`), { active: false }));
      await assertFails(updateDoc(doc(admin.db, `users/${admin.uid}`), { role: "staff" }));
    });

    test("an admin can approve or suspend staff, but not themselves, other admins, or anyone's role", async () => {
      await assertSucceeds(updateDoc(doc(admin.db, `users/${inactive.uid}`), { active: true }));
      await assertSucceeds(updateDoc(doc(admin.db, `users/${staff.uid}`), { active: false }));
      await assertFails(updateDoc(doc(admin.db, `users/${staff.uid}`), { role: "admin" }));
      await assertFails(updateDoc(doc(admin.db, `users/${admin.uid}`), { active: false }));
      await assertFails(updateDoc(doc(staff.db, `users/${inactive.uid}`), { active: true })); // staff can't approve anyone
    });
  });

  // Needs a private backup, so it only runs when BACKUP_FILE points at one.
  const backupFile = process.env.BACKUP_FILE;
  test(
    "EVERY real existing booking is accepted by the rules (readable, editable and cancellable)",
    { skip: backupFile && existsSync(backupFile) ? false : "set BACKUP_FILE to a simplified backup to run this" },
    async () => {
      const real = JSON.parse(readFileSync(backupFile!, "utf-8")) as ({ id: string } & Record<string, Plain>)[];
      assert.ok(real.length > 0);
      await seed(real.map(({ id, ...data }) => ({ path: `bookings/${id}`, data })));

      const snapshot = await getDocs(collection(staff.db, "bookings"));
      assert.equal(snapshot.size, real.length + 1); // + old1 from beforeEach

      const failures: string[] = [];
      for (const { id } of real) {
        try {
          await updateDoc(doc(staff.db, `bookings/${id}`), { updatedAt: serverTimestamp() }); // a no-op edit, as the app would write
        } catch (error) {
          failures.push(`${id}: ${(error as { code?: string }).code}`);
        }
      }
      assert.deepEqual(failures, [], `${failures.length} of ${real.length} real bookings were rejected`);

      // and a real cancellation, then a check that nothing else about the booking changed
      const sample = real[0];
      await updateDoc(doc(staff.db, `bookings/${sample.id}`), { status: "cancelled", updatedAt: serverTimestamp() });
      const after = (await getDoc(doc(staff.db, `bookings/${sample.id}`))).data()!;
      for (const key of ["pitch", "clientName", "contact", "date", "startTime", "endTime", "pricePerHour", "hours", "totalPayment"]) {
        assert.equal(after[key], sample[key], `${key} changed`);
      }
    },
  );
});
