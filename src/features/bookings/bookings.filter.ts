// Filtering, sorting and paging for the bookings list. It all happens in the browser on one year of bookings at a time,
// which keeps database reads bounded (AGENTS.md section 8).
import type { Booking } from "../../types/models.ts";

export type BookingFilters = {
  search: string;
  pitch: string; // "" = all pitches
  month: string; // "" = all months, otherwise "0".."11"
};

export type SortOrder = "newest" | "oldest";

export function filterBookings(bookings: readonly Booking[], filters: BookingFilters): Booking[] {
  const search = filters.search.trim().toLowerCase();
  return bookings.filter((booking) => {
    if (filters.pitch && booking.pitch !== filters.pitch) return false;
    // date is "YYYY-MM-DD", so the month is characters 5-7
    if (filters.month !== "" && Number(booking.date.slice(5, 7)) - 1 !== Number(filters.month)) return false;
    if (search && !booking.clientName.toLowerCase().includes(search) && !booking.contact.toLowerCase().includes(search)) return false;
    return true;
  });
}

export function sortBookings(bookings: readonly Booking[], order: SortOrder): Booking[] {
  const direction = order === "newest" ? -1 : 1;
  return [...bookings].sort((a, b) => direction * (a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
}

export type Page<T> = { items: T[]; page: number; pageCount: number; from: number; to: number; total: number };

// `page` is 1-based and is kept inside the valid range
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, from: total === 0 ? 0 : start + 1, to: Math.min(start + pageSize, total), total };
}
