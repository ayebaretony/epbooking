import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock, Hourglass, Phone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/StateMessages";
import { useAuth } from "@/features/auth/useAuth";
import { PitchTag } from "@/features/pitches/PitchTag";
import { usePitches } from "@/features/pitches/usePitches";
import { formatHours } from "@/lib/bookingMath";
import { formatLongDate, formatMoment } from "@/lib/dateFormat";
import { formatAed } from "@/lib/money";
import { normalizePhone, telHref, whatsappHref } from "@/lib/phone";
import { DEFAULT_CENTER_SETTINGS, bookingStatus } from "@/types/models";
import { CancelBookingModal } from "./CancelBookingModal";
import { DeleteBookingModal } from "./DeleteBookingModal";
import { StatusBadge } from "./StatusBadge";
import { useBooking } from "./hooks/useBooking";
import { useBookingDrawer } from "./useBookingDrawer";

const CURRENCY = DEFAULT_CENTER_SETTINGS.currency;
const TIMEZONE = DEFAULT_CENTER_SETTINGS.timezone;

function durationText(hours: number): string {
  return `${formatHours(hours)} ${hours === 1 ? "hour" : "hours"}`;
}

export function BookingDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state: auth } = useAuth();
  const isAdmin = auth.status === "active" && auth.profile.role === "admin";
  const { openEdit, version } = useBookingDrawer();
  const { state, reload } = useBooking(id, version);
  const { state: pitchState } = usePitches();
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const crumb = (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted">
      <Link to="/bookings" className="hover:text-ink hover:underline">
        Bookings
      </Link>
      <ChevronRight className="size-3" aria-hidden="true" />
      <span aria-current="page">Booking #{id.slice(0, 6).toUpperCase()}</span>
    </nav>
  );

  if (state.status === "loading")
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading booking">
        {crumb}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  if (state.status === "error")
    return (
      <div>
        {crumb}
        <Card className="mt-4">
          <ErrorState message="We couldn't load this booking." onRetry={reload} />
        </Card>
      </div>
    );
  if (state.data === null)
    return (
      <div>
        {crumb}
        <Card className="mt-4">
          <EmptyState title="Booking not found">
            It may have been deleted. <Link to="/bookings" className="font-medium text-primary hover:underline">Back to bookings</Link>
          </EmptyState>
        </Card>
      </div>
    );

  const booking = state.data;
  const cancelled = bookingStatus(booking) === "cancelled";
  const pitchColor = pitchState.status === "ready" ? (pitchState.data.find((pitch) => pitch.name === booking.pitch)?.color ?? "green") : "green";
  const phoneKnown = normalizePhone(booking.contact) !== null;
  const call = telHref(booking.contact);
  const whatsapp = whatsappHref(booking.contact);

  return (
    <div>
      {crumb}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display font-bold">{booking.clientName || "Booking"}</h1>
          <div className="mt-2 flex items-center gap-2">
            <PitchTag name={booking.pitch} color={pitchColor} />
            <StatusBadge booking={booking} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openEdit(booking)}>
            Edit
          </Button>
          {!cancelled ? (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Cancel booking
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Booking summary</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Fact icon={<CalendarDays className="size-4" />} label="Date" value={formatLongDate(booking.date)} />
            <Fact icon={<Clock className="size-4" />} label="Time" value={`${booking.startTime}–${booking.endTime}`} />
            <Fact icon={<Hourglass className="size-4" />} label="Duration" value={durationText(booking.hours)} />
            <Fact icon={<Wallet className="size-4" />} label="Rate" value={`${formatAed(booking.pricePerHour, CURRENCY)}/hr`} />
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-muted">Total payment</span>
            <span className="text-xl font-bold text-primary">{formatAed(booking.totalPayment, CURRENCY)}</span>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Client contact</h2>
          {booking.contact ? (
            <>
              <p className="mt-4 flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted" aria-hidden="true" />
                {booking.contact}
              </p>
              {phoneKnown ? (
                <div className="mt-4 flex gap-2">
                  {call ? (
                    <a href={call} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-sidebar">
                      Call
                    </a>
                  ) : null}
                  {whatsapp ? (
                    <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-sidebar">
                      WhatsApp
                    </a>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">No contact was recorded for this booking.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Booking type</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            <Row label="Type" value={booking.seriesId ? "Recurring" : "One-off"} />
            <Row label="Created by" value={booking.createdByName ?? "Not recorded"} />
            <Row label="Created" value={booking.createdAt ? formatMoment(booking.createdAt, TIMEZONE) : "Not recorded"} />
          </dl>
        </Card>
      </div>

      {isAdmin ? (
        <div className="mt-8">
          <button type="button" onClick={() => setDeleting(true)} className="text-xs font-medium text-danger hover:underline">
            Delete this booking permanently
          </button>
        </div>
      ) : null}

      {cancelling ? <CancelBookingModal booking={booking} onClose={() => setCancelling(false)} onCancelled={reload} /> : null}
      {deleting ? <DeleteBookingModal booking={booking} onClose={() => setDeleting(false)} onDeleted={() => navigate("/bookings", { replace: true })} /> : null}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
