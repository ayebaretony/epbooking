// Shapes of the data (AGENTS.md sections 3 and 5).
// The `bookings` collection is the EXISTING one: its nine original fields never change. Everything below
// "optional additive fields" is missing on old documents and must be treated as its default when absent.

export type BookingStatus = "confirmed" | "pending" | "cancelled";

// bookings/{id}, plus the document id
export type Booking = {
  id: string;
  // --- original fields, present on every existing document, formats never change ---
  pitch: string; // "Fifa Pitch" | "Airdome" | "Junior Football Pitch" | "Half Pitch" (the name is the identity)
  clientName: string;
  contact: string; // phone number, may be empty
  date: string; // "YYYY-MM-DD", business local time (Asia/Dubai). A string, not a Timestamp
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  pricePerHour: number; // AED, may have decimals
  hours: number; // stored at write time
  totalPayment: number; // AED, stored at write time. Never recomputed for existing bookings
  // --- optional additive fields, absent on old documents ---
  status?: BookingStatus; // missing = "confirmed"
  notes?: string;
  createdBy?: string; // uid
  createdByName?: string; // the creator's name at the time, so any staff member can see who made it
  createdAt?: Date;
  updatedAt?: Date;
  seriesId?: string; // recurring bookings share one
};

// What the app reads when a booking has no status
export function bookingStatus(booking: Pick<Booking, "status">): BookingStatus {
  return booking.status ?? "confirmed";
}

export type UserRole = "admin" | "staff";

// users/{uid}
export type UserProfile = {
  displayName: string;
  email: string;
  role: UserRole;
  active: boolean;
};

// pitches/{pitchSlug}. `name` must match the `pitch` string on bookings exactly and is never renamed (archive instead).
// Pitches have no fixed price: each client's rate is negotiated, so every booking stores its own pricePerHour.
// defaultRatePerHour (AED) is optional (absent = "Not set") and only ever prefills the booking form.
export type Pitch = {
  id: string; // pitchSlug, e.g. "fifa-pitch"
  name: string;
  description: string; // e.g. "11-a-side"
  defaultRatePerHour?: number;
  color: string;
  sortOrder: number;
  archived: boolean;
};

// slots/{pitchSlug}_{date}_{HHmm}: one per occupied 30-minute slot (the double-booking guard)
export type Slot = {
  pitch: string;
  date: string;
  bookingId: string;
};

// Fixed business settings (code constants, no Firestore document in the first version)
export type CenterSettings = {
  centerName: string;
  currency: string;
  timezone: string; // IANA
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  slotMinutes: number;
};

// Closing time is 23:00 because real bookings run that late.
export const DEFAULT_CENTER_SETTINGS: CenterSettings = {
  centerName: "Palace Sports",
  currency: "AED",
  timezone: "Asia/Dubai",
  openTime: "07:00",
  closeTime: "23:00",
  slotMinutes: 30,
};
