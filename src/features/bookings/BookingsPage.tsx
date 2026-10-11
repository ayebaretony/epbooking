import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/StateMessages";
import { useAuth } from "@/features/auth/useAuth";
import { PitchTag } from "@/features/pitches/PitchTag";
import { usePitches } from "@/features/pitches/usePitches";
import { formatHours } from "@/lib/bookingMath";
import { formatDate } from "@/lib/dateFormat";
import { formatAed } from "@/lib/money";
import { todayInTimezone } from "@/lib/time";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";
import type { Booking, Pitch } from "@/types/models";
import { DeleteBookingModal } from "./DeleteBookingModal";
import { StatusBadge } from "./StatusBadge";
import { filterBookings, paginate, sortBookings, type BookingFilters, type SortOrder } from "./bookings.filter";
import { useBookingDrawer } from "./useBookingDrawer";
import { useBookingsForYear } from "./hooks/useBookingsForYear";
import { useBookingYears } from "./hooks/useBookingYears";

const PAGE_SIZE = 10;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CURRENCY = DEFAULT_CENTER_SETTINGS.currency;
const selectClass = "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-primary";

const colorOf = (pitches: readonly Pitch[], name: string) => pitches.find((pitch) => pitch.name === name)?.color ?? "green";

export function BookingsPage() {
  const { state: auth } = useAuth();
  const isAdmin = auth.status === "active" && auth.profile.role === "admin";
  const { openNew, openEdit, version } = useBookingDrawer();

  const currentYear = Number(todayInTimezone(DEFAULT_CENTER_SETTINGS.timezone).slice(0, 4));
  const years = useBookingYears(currentYear);
  const [year, setYear] = useState(currentYear);
  const [filters, setFilters] = useState<BookingFilters>({ search: "", pitch: "", month: "" });
  const [order, setOrder] = useState<SortOrder>("newest");
  const [pageNumber, setPageNumber] = useState(1);
  const [toDelete, setToDelete] = useState<Booking | null>(null);

  const { state, reload } = useBookingsForYear(year, version);
  const { state: pitchState } = usePitches();
  const pitches = pitchState.status === "ready" ? pitchState.data : [];

  const all = state.status === "ready" ? state.data : [];
  const filtered = sortBookings(filterBookings(all, filters), order);
  const page = paginate(filtered, pageNumber, PAGE_SIZE);
  const filtering = filters.search !== "" || filters.pitch !== "" || filters.month !== "";

  function change(update: Partial<BookingFilters>) {
    setFilters((current) => ({ ...current, ...update }));
    setPageNumber(1);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-display font-bold">Bookings</h1>
          <p className="mt-1 text-sm text-muted">
            {state.status === "ready" ? `${filtered.length} ${filtered.length === 1 ? "booking" : "bookings"} in ${year}` : " "}
          </p>
        </div>
        <Button onClick={() => openNew()} className="shrink-0">
          <Plus className="size-4" aria-hidden="true" />
          New booking
        </Button>
      </div>

      <Card className="mt-6 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search client</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => change({ search: event.target.value })}
              placeholder="Search client"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm focus:border-primary"
            />
          </label>
          <select aria-label="Pitch" value={filters.pitch} onChange={(event) => change({ pitch: event.target.value })} className={selectClass}>
            <option value="">All pitches</option>
            {pitches.map((pitch) => (
              <option key={pitch.id} value={pitch.name}>
                {pitch.name}
              </option>
            ))}
          </select>
          <select aria-label="Month" value={filters.month} onChange={(event) => change({ month: event.target.value })} className={selectClass}>
            <option value="">All months</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
          <select
            aria-label="Year"
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              setPageNumber(1);
            }}
            className={selectClass}
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select aria-label="Sort" value={order} onChange={(event) => setOrder(event.target.value as SortOrder)} className={selectClass}>
            <option value="newest">Sort by date newest</option>
            <option value="oldest">Sort by date oldest</option>
          </select>
        </div>
      </Card>

      <div className="mt-4">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading bookings">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-14" />
            ))}
          </div>
        ) : null}
        {state.status === "error" ? (
          <Card>
            <ErrorState message="We couldn't load the bookings." onRetry={reload} />
          </Card>
        ) : null}
        {state.status === "ready" && page.total === 0 ? (
          <Card>
            <EmptyState title={filtering ? "No bookings match these filters" : `No bookings in ${year} yet`}>
              {filtering ? (
                <button type="button" onClick={() => change({ search: "", pitch: "", month: "" })} className="font-medium text-primary hover:underline">
                  Clear filters
                </button>
              ) : (
                "Create the first one with New booking."
              )}
            </EmptyState>
          </Card>
        ) : null}

        {state.status === "ready" && page.total > 0 ? (
          <>
            {/* Desktop: a table */}
            <Card className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-sidebar text-xs text-muted">
                    {["Pitch", "Client", "Date", "Start", "End", "Hours", "Rate", "Total (AED)", "Status", "Actions"].map((heading) => (
                      <th key={heading} scope="col" className="px-3 py-3 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((booking) => (
                    <tr key={booking.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-3">
                        <PitchTag name={booking.pitch} color={colorOf(pitches, booking.pitch)} />
                      </td>
                      <td className="px-3 py-3 font-medium">{booking.clientName}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatDate(booking.date)}</td>
                      <td className="px-3 py-3">{booking.startTime}</td>
                      <td className="px-3 py-3">{booking.endTime}</td>
                      <td className="px-3 py-3">{formatHours(booking.hours)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatAed(booking.pricePerHour, CURRENCY)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{formatAed(booking.totalPayment, CURRENCY)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge booking={booking} />
                      </td>
                      <td className="px-3 py-3">
                        <RowActions booking={booking} isAdmin={isAdmin} onEdit={() => openEdit(booking)} onDelete={() => setToDelete(booking)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Phone: cards */}
            <ul className="flex flex-col gap-3 md:hidden">
              {page.items.map((booking) => (
                <li key={booking.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <PitchTag name={booking.pitch} color={colorOf(pitches, booking.pitch)} />
                      <RowActions booking={booking} isAdmin={isAdmin} onEdit={() => openEdit(booking)} onDelete={() => setToDelete(booking)} />
                    </div>
                    <p className="mt-2 text-base font-semibold">{booking.clientName}</p>
                    <p className="text-sm text-muted">
                      {formatDate(booking.date)} · {booking.startTime}–{booking.endTime}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span>
                        {formatHours(booking.hours)}h · <span className="font-medium">{formatAed(booking.totalPayment, CURRENCY)}</span>
                      </span>
                      <StatusBadge booking={booking} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <Pagination page={page} noun={page.total === 1 ? "booking" : "bookings"} onPage={setPageNumber} />
          </>
        ) : null}
      </div>

      {toDelete ? <DeleteBookingModal booking={toDelete} onClose={() => setToDelete(null)} onDeleted={reload} /> : null}
    </div>
  );
}

const iconButton = "flex size-8 items-center justify-center rounded-md text-muted hover:bg-sidebar hover:text-ink";

// View, edit and (admins only) delete. Staff cancel from the booking's page instead.
function RowActions({ booking, isAdmin, onEdit, onDelete }: { booking: Booking; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const who = booking.clientName || "booking";
  return (
    <div className="flex items-center gap-0.5">
      <Link to={`/bookings/${booking.id}`} aria-label={`View ${who}`} className={iconButton}>
        <Eye className="size-4" aria-hidden="true" />
      </Link>
      <button type="button" onClick={onEdit} aria-label={`Edit ${who}`} className={iconButton}>
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      {isAdmin ? (
        <button type="button" onClick={onDelete} aria-label={`Delete ${who}`} className={`${iconButton} hover:text-danger`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
