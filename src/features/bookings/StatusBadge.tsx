import { bookingStatus } from "@/types/models";
import type { Booking } from "@/types/models";

const STYLES = {
  confirmed: "bg-pitch-green-tint text-primary",
  pending: "bg-pitch-amber-tint text-pitch-amber",
  cancelled: "bg-danger-tint text-danger",
} as const;

const LABELS = { confirmed: "Confirmed", pending: "Pending", cancelled: "Cancelled" } as const;

// A booking with no status field (every existing booking) shows as Confirmed
export function StatusBadge({ booking }: { booking: Pick<Booking, "status"> }) {
  const status = bookingStatus(booking);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>{LABELS[status]}</span>;
}
