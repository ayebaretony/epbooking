// Turns a raw Firestore document into a Booking, tolerating anything odd in old data (AGENTS.md section 2: code must work
// on every existing document). Pure and dependency-free so it can be unit-tested.
import type { Booking, BookingStatus } from "../../types/models.ts";

const STATUSES: readonly string[] = ["confirmed", "pending", "cancelled"];

function toDate(value: unknown): Date | undefined {
  // Firestore Timestamps have toDate(); this avoids importing the SDK here
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate();
  return value instanceof Date ? value : undefined;
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export function mapBooking(id: string, data: Record<string, unknown>): Booking {
  const booking: Booking = {
    id,
    pitch: text(data.pitch),
    clientName: text(data.clientName),
    contact: text(data.contact),
    date: text(data.date),
    startTime: text(data.startTime),
    endTime: text(data.endTime),
    pricePerHour: num(data.pricePerHour),
    hours: num(data.hours),
    totalPayment: num(data.totalPayment),
  };
  // Optional fields are only set when they are really there: old bookings have none of them
  if (typeof data.status === "string" && STATUSES.includes(data.status)) booking.status = data.status as BookingStatus;
  if (typeof data.notes === "string") booking.notes = data.notes;
  if (typeof data.createdBy === "string") booking.createdBy = data.createdBy;
  if (typeof data.createdByName === "string") booking.createdByName = data.createdByName;
  if (typeof data.seriesId === "string") booking.seriesId = data.seriesId;
  const createdAt = toDate(data.createdAt);
  if (createdAt) booking.createdAt = createdAt;
  const updatedAt = toDate(data.updatedAt);
  if (updatedAt) booking.updatedAt = updatedAt;
  return booking;
}
