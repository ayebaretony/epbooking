// Shared by the emulator tests. EMULATOR ONLY (fake project "demo-epbooking"), never production.
import assert from "node:assert/strict";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, setLogLevel, type Firestore } from "firebase/firestore";

// The SDK logs every denial it receives; the tests expect many, so keep the output readable.
setLogLevel("silent");

export const PROJECT = "demo-epbooking";
export const FIRESTORE = "http://127.0.0.1:8080";
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;

export type Plain = string | number | boolean | null | Date;

function toValue(v: Plain) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
}

// Writes documents as the emulator's admin ("owner" token bypasses the rules), to set up test data.
export async function seed(docs: { path: string; data: Record<string, Plain> }[]) {
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

export async function clearFirestore() {
  const res = await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(res.status, 200);
}

export async function assertSucceeds(promise: Promise<unknown>) {
  await promise;
}

export async function assertFails(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: { code?: string }) => error.code === "permission-denied");
}

export type Principal = { db: Firestore; uid: string | null };
const apps: FirebaseApp[] = [];

// A signed-in person (or nobody, when email is null) as seen by Firestore. The account is created on first use.
export async function principal(name: string, email: string | null): Promise<Principal> {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, name);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  if (email === null) return { db, uid: null };
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, "test-password-123");
    return { db, uid: user.uid };
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/email-already-in-use") throw error;
    const { user } = await signInWithEmailAndPassword(auth, email, "test-password-123");
    return { db, uid: user.uid };
  }
}

export async function closeApps() {
  await Promise.all(apps.map((app) => deleteApp(app)));
}

// A booking exactly as the existing system stored them: the nine original fields only.
export const legacyBooking = (overrides: Record<string, Plain> = {}) => ({
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

// Creates the approved test people (admin and staff) the rules require
export async function seedPeople(admin: Principal, staff: Principal) {
  const now = new Date();
  await seed([
    { path: `users/${admin.uid}`, data: { displayName: "Admin", email: "admin@test.local", role: "admin", active: true, createdAt: now } },
    { path: `users/${staff.uid}`, data: { displayName: "Staff", email: "staff@test.local", role: "staff", active: true, createdAt: now } },
  ]);
}
