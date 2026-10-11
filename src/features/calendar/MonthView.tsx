import { Card } from "@/components/ui/Card";
import { pitchStyles } from "@/features/pitches/pitchStyles";
import { dayOfMonth, formatDateWithDay, formatWeekdayShort } from "@/lib/dateFormat";
import type { Booking, Pitch } from "@/types/models";

type Props = {
  dates: readonly string[]; // 42 dates, Monday first
  month: string; // any date in the month being shown, to dim the days around it
  today: string;
  pitches: readonly Pitch[];
  bookings: readonly Booking[];
  onOpenDay: (date: string) => void;
};

const MAX_CHIPS = 3;

export function MonthView({ dates, month, today, pitches, bookings, onOpenDay }: Props) {
  const colorOf = (name: string) => pitches.find((pitch) => pitch.name === name)?.color ?? "green";
  const byDate = new Map<string, Booking[]>();
  for (const booking of bookings) byDate.set(booking.date, [...(byDate.get(booking.date) ?? []), booking]);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-sidebar text-center text-xs font-medium text-muted">
        {dates.slice(0, 7).map((date) => (
          <div key={date} className="py-2.5">
            {formatWeekdayShort(date)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const items = (byDate.get(date) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const inMonth = date.slice(0, 7) === month.slice(0, 7);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`${formatDateWithDay(date)}, ${items.length} ${items.length === 1 ? "booking" : "bookings"}`}
              className={`flex min-h-16 flex-col items-stretch gap-1 border-b border-l border-line p-1.5 text-left hover:bg-sidebar md:min-h-28 ${inMonth ? "" : "bg-page text-muted"}`}
            >
              <span className={`flex size-6 items-center justify-center self-start rounded-full text-xs font-medium ${date === today ? "bg-primary text-white" : ""}`}>{dayOfMonth(date)}</span>
              {/* Desktop: the bookings themselves */}
              <span className="hidden flex-col gap-1 md:flex">
                {items.slice(0, MAX_CHIPS).map((booking) => (
                  <span key={booking.id} className={`truncate rounded border-l-4 px-1.5 py-0.5 text-xs ${pitchStyles(colorOf(booking.pitch)).block}`}>
                    {booking.startTime} {booking.clientName}
                  </span>
                ))}
                {items.length > MAX_CHIPS ? <span className="px-1 text-xs font-medium text-primary">+{items.length - MAX_CHIPS} more</span> : null}
              </span>
              {/* Phone: coloured dots, tap the day for details */}
              <span className="flex flex-wrap gap-1 md:hidden" aria-hidden="true">
                {items.slice(0, 4).map((booking) => (
                  <span key={booking.id} className={`size-1.5 rounded-full border-0 ${pitchStyles(colorOf(booking.pitch)).dot}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
