// All booking reads and writes. Components never call Firestore directly (AGENTS.md section 4).
//
// The database is passed in, so the same code runs in the app and in the emulator tests (relative .ts imports, no "@/").
//
// DOUBLE-BOOKING GUARD (AGENTS.md section 6): every booking owns one `slots` document per 30 minutes. Creating, editing,
// cancelling and deleting read and write the booking and its slots in ONE transaction. If any slot is already taken by a
// different booking the whole thing fails and nothing is written. Two people booking the same time at the same moment:
// one wins, the other gets "That time is no longer available."
//
// EXISTING DATA (AGENTS.md section 2): an old booking is only written when a person edits, cancels or deletes THAT booking.
// Editing leaves hours and totalPayment exactly as stored unless the times or the price were changed.
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where,
  type DocumentReference, type Firestore,
} from "firebase/firestore";
import { SLOT_MINUTES, priceBooking, timeToMinutes } from "../../lib/bookingMath.ts";
import { pitchSlug, slotKeysFor } from "../../lib/conflicts.ts";
import type { TakenSlots } from "../../lib/availability.ts";
import type { Booking } from "../../types/models.ts";
import { mapBooking } from "./booking.mapper.ts";
import type { BookingInput } from "./booking.validation.ts";

export class SlotConflictError extends Error {
  readonly date: string;
  constructor(date: string) {
    super("That time is no longer available.");
    this.name = "SlotConflictError";
    this.date = date;
  }
}

type Author = { uid: string; name: string };

// The slot documents a booking occupies (empty if its times can't be read)
export function bookingSlotKeys(booking: Pick<Booking, "pitch" | "date" | "startTime" | "endTime">): string[] {
  const start = timeToMinutes(booking.startTime);
  const end = timeToMinutes(booking.endTime);
  if (start === null || end === null || end <= start) return [];
  return slotKeysFor(pitchSlug(booking.pitch), booking.date, start, end, SLOT_MINUTES);
}

const isCancelled = (booking: Pick<Booking, "status">) => booking.status === "cancelled";

// ---------- reads ----------

// Bookings between two dates (both included), a bounded query on the `date` text (AGENTS.md section 5). Every list and
// calendar view is built from this, so reads stay small.
export async function listBookingsInRange(db: Firestore, from: string, to: string): Promise<Booking[]> {
  const snapshot = await getDocs(query(collection(db, "bookings"), where("date", ">=", from), where("date", "<=", to), orderBy("date")));
  return snapshot.docs.map((entry) => mapBooking(entry.id, entry.data()));
}

// One calendar year of bookings
export function listBookingsForYear(db: Firestore, year: number): Promise<Booking[]> {
  return listBookingsInRange(db, `${year}-01-01`, `${year}-12-31`);
}

// A live feed of one day's bookings (for the Today screen). Calls `onChange` straight away and again whenever any booking
// that day is created, edited, cancelled or deleted, by anyone. Returns the function that stops listening.
export function subscribeToDay(db: Firestore, date: string, onChange: (bookings: Booking[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(
    query(collection(db, "bookings"), where("date", "==", date)),
    (snapshot) => onChange(snapshot.docs.map((entry) => mapBooking(entry.id, entry.data()))),
    onError,
  );
}

// The first and last year that have bookings, for the Year filter
export async function getBookingYearRange(db: Firestore): Promise<{ first: number; last: number } | null> {
  const [earliest, latest] = await Promise.all([
    getDocs(query(collection(db, "bookings"), orderBy("date", "asc"), limit(1))),
    getDocs(query(collection(db, "bookings"), orderBy("date", "desc"), limit(1))),
  ]);
  const first = Number(String(earliest.docs[0]?.data().date ?? "").slice(0, 4));
  const last = Number(String(latest.docs[0]?.data().date ?? "").slice(0, 4));
  return first && last ? { first, last } : null;
}

export async function getBooking(db: Firestore, id: string): Promise<Booking | null> {
  const snapshot = await getDoc(doc(db, "bookings", id));
  return snapshot.exists() ? mapBooking(snapshot.id, snapshot.data()) : null;
}

// Every slot already taken on this pitch on these dates (slotId -> owning booking id). Used to show "available" before saving.
export async function fetchTakenSlots(db: Firestore, pitch: string, dates: readonly string[]): Promise<TakenSlots> {
  const taken = new Map<string, string>();
  const unique = [...new Set(dates)];
  for (let i = 0; i < unique.length; i += 30) {
    // Firestore allows 30 values in one `in` query
    const snapshot = await getDocs(query(collection(db, "slots"), where("pitch", "==", pitch), where("date", "in", unique.slice(i, i + 30))));
    for (const entry of snapshot.docs) taken.set(entry.id, String(entry.data().bookingId));
  }
  return taken;
}

// ---------- writes ----------

export type NewBooking = BookingInput & { seriesId?: string };

// Creates one booking and its slots. Returns the new booking's id. Throws SlotConflictError if any slot is taken.
export async function createBooking(db: Firestore, author: Author, input: NewBooking): Promise<string> {
  const pricing = priceBooking(input.rateFils, input.startTime, input.endTime);
  if (!pricing) throw new Error("Invalid booking times.");
  const reference = doc(collection(db, "bookings"));
  const keys = bookingSlotKeys(input);

  await runTransaction(db, async (transaction) => {
    const slots = await Promise.all(keys.map((key) => transaction.get(doc(db, "slots", key))));
    if (slots.some((slot) => slot.exists())) throw new SlotConflictError(input.date);

    transaction.set(reference, {
      pitch: input.pitch,
      clientName: input.clientName,
      contact: input.contact,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      pricePerHour: input.pricePerHour,
      hours: pricing.hours,
      totalPayment: pricing.totalPayment,
      status: "confirmed",
      createdBy: author.uid,
      createdByName: author.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(input.seriesId ? { seriesId: input.seriesId } : {}),
    });
    for (const key of keys) transaction.set(doc(db, "slots", key), { pitch: input.pitch, date: input.date, bookingId: reference.id });
  });
  return reference.id;
}

export type SeriesResult = { created: string[]; failed: { date: string; reason: string }[] };

// A recurring series: one booking per date, each through its own transaction. The form checks every date first, so a clash
// here only happens if someone else booked in the meantime. Every date is reported either way, never silently skipped.
export async function createSeries(db: Firestore, author: Author, input: NewBooking, dates: readonly string[]): Promise<SeriesResult> {
  const seriesId = doc(collection(db, "bookings")).id; // just a unique id to group the series
  const result: SeriesResult = { created: [], failed: [] };
  for (const date of dates) {
    try {
      result.created.push(await createBooking(db, author, { ...input, date, seriesId }));
    } catch (error) {
      result.failed.push({ date, reason: error instanceof SlotConflictError ? "already booked" : "could not be saved" });
    }
  }
  return result;
}

// What can be edited on a booking
export type BookingEdit = BookingInput;

export async function updateBooking(db: Firestore, existing: Booking, edit: BookingEdit): Promise<void> {
  const reference = doc(db, "bookings", existing.id);
  const cancelled = isCancelled(existing);
  const oldKeys = cancelled ? [] : bookingSlotKeys(existing);
  const newKeys = cancelled ? [] : bookingSlotKeys(edit);

  // hours and totalPayment are only recalculated when the times or the price changed. Otherwise the stored figures stay as they are.
  const repriced = edit.startTime !== existing.startTime || edit.endTime !== existing.endTime || edit.pricePerHour !== existing.pricePerHour;
  const pricing = priceBooking(edit.rateFils, edit.startTime, edit.endTime);
  if (!pricing) throw new Error("Invalid booking times.");

  await runTransaction(db, async (transaction) => {
    const current = await Promise.all(newKeys.map((key) => transaction.get(doc(db, "slots", key))));
    const toCreate: string[] = [];
    current.forEach((slot, index) => {
      if (!slot.exists()) toCreate.push(newKeys[index]);
      else if (slot.data().bookingId !== existing.id) throw new SlotConflictError(edit.date);
    });

    // Free the slots this booking no longer needs (only ones that really belong to it)
    const toFree = oldKeys.filter((key) => !newKeys.includes(key));
    const owned = await Promise.all(toFree.map((key) => transaction.get(doc(db, "slots", key))));

    transaction.update(reference, {
      pitch: edit.pitch,
      clientName: edit.clientName,
      contact: edit.contact,
      date: edit.date,
      startTime: edit.startTime,
      endTime: edit.endTime,
      pricePerHour: edit.pricePerHour,
      ...(repriced ? { hours: pricing.hours, totalPayment: pricing.totalPayment } : {}),
      updatedAt: serverTimestamp(),
    });
    owned.forEach((slot, index) => {
      if (slot.exists() && slot.data().bookingId === existing.id) transaction.delete(doc(db, "slots", toFree[index]));
    });
    for (const key of toCreate) transaction.set(doc(db, "slots", key), { pitch: edit.pitch, date: edit.date, bookingId: existing.id });
  });
}

// Frees the booking's slots (only ones that really belong to it)
async function releaseSlots(db: Firestore, transaction: Parameters<Parameters<typeof runTransaction>[1]>[0], booking: Booking) {
  const keys = bookingSlotKeys(booking);
  const slots = await Promise.all(keys.map((key) => transaction.get(doc(db, "slots", key))));
  return () => slots.forEach((slot, index) => slot.exists() && slot.data().bookingId === booking.id && transaction.delete(doc(db, "slots", keys[index])));
}

// The booking stays in the records, marked cancelled, and no longer reserves the pitch
export async function cancelBooking(db: Firestore, existing: Booking): Promise<void> {
  const reference: DocumentReference = doc(db, "bookings", existing.id);
  await runTransaction(db, async (transaction) => {
    const release = await releaseSlots(db, transaction, existing);
    transaction.update(reference, { status: "cancelled", updatedAt: serverTimestamp() });
    release();
  });
}

// Permanent. Only admins can do this (the security rules enforce it too).
export async function deleteBooking(db: Firestore, existing: Booking): Promise<void> {
  const reference = doc(db, "bookings", existing.id);
  await runTransaction(db, async (transaction) => {
    const release = await releaseSlots(db, transaction, existing);
    transaction.delete(reference);
    release();
  });
}
