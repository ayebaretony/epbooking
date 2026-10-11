import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { formatDate } from "@/lib/dateFormat";
import { db } from "@/lib/firebase";
import type { Booking } from "@/types/models";
import { deleteBooking } from "./bookings.service";

// Admin only (the security rules enforce it too). Permanent, so it asks first.
export function DeleteBookingModal({ booking, onClose, onDeleted }: { booking: Booking; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await deleteBooking(db, booking);
      toast.show("Booking deleted");
      onDeleted();
      onClose();
    } catch {
      toast.show("We couldn't delete this booking. Please try again.", "error");
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete booking permanently?" onClose={onClose}>
      <p className="text-sm text-muted">
        {booking.clientName || "This booking"} on {formatDate(booking.date)}, {booking.startTime}–{booking.endTime}. This action cannot be undone. To keep it in your records, cancel the booking instead.
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => void confirm()} loading={busy}>
          Delete booking
        </Button>
      </div>
    </Modal>
  );
}
