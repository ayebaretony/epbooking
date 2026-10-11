import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { db } from "@/lib/firebase";
import type { Booking } from "@/types/models";
import { cancelBooking } from "./bookings.service";

// Cancelling keeps the booking on record and frees the pitch
export function CancelBookingModal({ booking, onClose, onCancelled }: { booking: Booking; onClose: () => void; onCancelled: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await cancelBooking(db, booking);
      toast.show("Booking cancelled");
      onCancelled();
      onClose();
    } catch {
      toast.show("We couldn't cancel this booking. Please try again.", "error");
      setBusy(false);
    }
  }

  return (
    <Modal title="Cancel this booking?" onClose={onClose}>
      <p className="text-sm text-muted">It will remain in your records but will no longer reserve the pitch.</p>
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
          Keep booking
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => void confirm()} loading={busy}>
          Cancel booking
        </Button>
      </div>
    </Modal>
  );
}
