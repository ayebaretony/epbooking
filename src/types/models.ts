import type { Timestamp } from "firebase/firestore";

// Shapes of the NEW collections (AGENTS.md section 5). The legacy `bookings` collection is not modelled here:
// it is only ever read by the migration script.

export type UserRole = "admin" | "staff";

// users/{uid}
export type UserProfile = {
  displayName: string;
  email: string;
  role: UserRole;
  active: boolean;
};

export type PitchStatus = "available" | "maintenance";

// pitches/{pitchId}. Pitches carry no price: the hourly rate is typed on each reservation.
export type Pitch = {
  id: string;
  name: string;
  surface: string;
  status: PitchStatus;
  color: string;
  sortOrder: number;
  archived: boolean;
};

export type ReservationStatus = "confirmed" | "pending" | "cancelled";

// reservations/{reservationId}, plus the document id
export type Reservation = {
  id: string;
  pitchId: string;
  pitchName: string; // denormalized for display
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  date: string; // "YYYY-MM-DD" in the center timezone
  startAt: Timestamp;
  endAt: Timestamp;
  durationMinutes: number;
  hourlyRateMinor: number; // fils
  totalMinor: number; // fils, a snapshot that is never recomputed
  status: ReservationStatus;
  notes: string | null;
  createdBy: string; // uid, or "legacy-import"
  createdAt: Timestamp;
  updatedAt: Timestamp;
  seriesId?: string; // recurring bookings share one
  legacyId?: string; // id of the legacy `bookings` document this was copied from
  source?: "legacy-import";
};

// blocks/{blockId}: a pitch closed for part of a day (maintenance)
export type Block = {
  id: string;
  pitchId: string;
  startAt: Timestamp;
  endAt: Timestamp;
  reason: string;
  createdBy: string;
};

// settings/center
export type CenterSettings = {
  centerName: string;
  currency: string;
  timezone: string; // IANA
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
  slotMinutes: number;
};

// Used until settings/center has been seeded. Closing time is 23:00 because real bookings run that late.
export const DEFAULT_CENTER_SETTINGS: CenterSettings = {
  centerName: "Palace Sports",
  currency: "AED",
  timezone: "Asia/Dubai",
  openTime: "07:00",
  closeTime: "23:00",
  slotMinutes: 30,
};
