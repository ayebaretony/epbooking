import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { pitchStyles } from "@/features/pitches/pitchStyles";
import { PitchTag, ColorDot } from "@/features/pitches/PitchTag";
import { dayOfMonth, formatDateWithDay, formatWeekdayShort } from "@/lib/dateFormat";
import type { Booking, Pitch } from "@/types/models";

type Props = {
  dates: readonly string[]; // the seven days, Monday first
  today: string;
  pitches: readonly Pitch[];
  bookings: readonly Booking[]; // active bookings in these days
  onOpenDay: (date: string) => void;
  onAdd: (pitch: Pitch, date: string) => void;
};

const byStart = (a: Booking, b: Booking) => a.startTime.localeCompare(b.startTime);

export function WeekView({ dates, today, pitches, bookings, onOpenDay, onAdd }: Props) {
  const forCell = (pitch: Pitch, date: string) => bookings.filter((booking) => booking.pitch === pitch.name && booking.date === date).sort(byStart);

  return (
    <>
      {/* Desktop: pitches down the side, days across */}
      <Card className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[56rem] grid-cols-[9.5rem_repeat(7,minmax(0,1fr))]">
          <div className="border-b border-line bg-sidebar px-3 py-2.5 text-xs font-medium text-muted">Pitch</div>
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`Open ${formatDateWithDay(date)}`}
              className={`border-b border-l border-line px-2 py-2.5 text-center text-xs font-medium hover:bg-nav-active/60 ${date === today ? "bg-nav-active text-primary" : "bg-sidebar text-muted"}`}
            >
              {formatWeekdayShort(date)} {dayOfMonth(date)}
            </button>
          ))}

          {pitches.map((pitch) => (
            <div key={pitch.id} className="contents">
              <div className="flex items-start gap-2 border-b border-line px-3 py-3 text-sm font-medium last-of-type:border-b-0">
                <ColorDot color={pitch.color} className="mt-1 shrink-0" />
                <span>{pitch.name}</span>
              </div>
              {dates.map((date) => {
                const items = forCell(pitch, date);
                return (
                  <div key={date} className={`group relative min-h-24 border-b border-l border-line p-1.5 ${date === today ? "bg-page" : ""}`}>
                    <ul className="flex flex-col gap-1">
                      {items.map((booking) => (
                        <li key={booking.id}>
                          <Link to={`/bookings/${booking.id}`} className={`block rounded-md border-l-4 px-1.5 py-1 text-xs hover:brightness-95 ${pitchStyles(pitch.color).block}`}>
                            <p className="truncate font-semibold">{booking.clientName}</p>
                            <p className="truncate opacity-80">
                              {booking.startTime}–{booking.endTime}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => onAdd(pitch, date)}
                      aria-label={`New booking on ${pitch.name}, ${formatDateWithDay(date)}`}
                      className={`flex w-full items-center justify-center rounded-md text-muted hover:bg-sidebar hover:text-primary ${items.length === 0 ? "absolute inset-1.5 h-auto opacity-0 focus-visible:opacity-100 group-hover:opacity-100" : "mt-1 h-6 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"}`}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Phone: an agenda, one block per day */}
      <ul className="flex flex-col gap-3 md:hidden">
        {dates.map((date) => {
          const items = bookings.filter((booking) => booking.date === date).sort(byStart);
          return (
            <li key={date}>
              <Card className={`p-4 ${date === today ? "border-primary" : ""}`}>
                <button type="button" onClick={() => onOpenDay(date)} className="flex w-full items-center justify-between text-left text-sm font-semibold">
                  <span>{formatDateWithDay(date)}</span>
                  <span className="text-xs font-normal text-muted">{items.length === 0 ? "No bookings" : `${items.length} ${items.length === 1 ? "booking" : "bookings"}`}</span>
                </button>
                {items.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {items.map((booking) => {
                      const pitch = pitches.find((entry) => entry.name === booking.pitch);
                      return (
                        <li key={booking.id}>
                          <Link to={`/bookings/${booking.id}`} className={`block rounded-lg border-l-4 px-3 py-2 ${pitchStyles(pitch?.color ?? "green").block}`}>
                            <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                              <span className="truncate">{booking.clientName}</span>
                              <span className="shrink-0 text-xs font-normal">
                                {booking.startTime}–{booking.endTime}
                              </span>
                            </p>
                            <p className="mt-1">
                              <PitchTag name={booking.pitch} color={pitch?.color ?? "green"} />
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
