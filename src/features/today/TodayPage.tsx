import { Link } from "react-router-dom";
import { CalendarCheck, CircleCheck, Clock, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, ErrorState } from "@/components/ui/StateMessages";
import { useBookingDrawer } from "@/features/bookings/useBookingDrawer";
import { useTodayBookings } from "@/features/bookings/hooks/useTodayBookings";
import { PitchTag } from "@/features/pitches/PitchTag";
import { usePitches } from "@/features/pitches/usePitches";
import { DaySchedule } from "@/features/schedule/DaySchedule";
import { formatHours, minutesToTime, timeToMinutes } from "@/lib/bookingMath";
import { formatLongDate } from "@/lib/dateFormat";
import { formatAed } from "@/lib/money";
import { browserStorage, readDefaultDuration } from "@/lib/preferences";
import { dayStats, formatStartsIn, freeSlotCount, nextBooking, pitchSegments, suggestedSlot } from "@/lib/schedule";
import { minutesOfDay, todayInTimezone } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";

const { currency, timezone, openTime, closeTime } = DEFAULT_CENTER_SETTINGS;
const OPEN = timeToMinutes(openTime) ?? 420;
const CLOSE = timeToMinutes(closeTime) ?? 1380;

export function TodayPage() {
  const now = useNow();
  const today = todayInTimezone(timezone, now);
  const nowMinutes = minutesOfDay(now, timezone);
  const { openNew } = useBookingDrawer();
  const { state: feed, retry } = useTodayBookings(today);
  const { state: pitchState, reload: reloadPitches } = usePitches();

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-display font-bold">Today</h1>
        <p className="mt-1 text-sm text-muted">{formatLongDate(today)}</p>
      </div>
      <Button onClick={() => openNew({ date: today })} className="shrink-0">
        <Plus className="size-4" aria-hidden="true" />
        New booking
      </Button>
    </div>
  );

  if (feed.status === "loading" || pitchState.status === "loading")
    return (
      <div>
        {header}
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4" role="status" aria-label="Loading today">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-4 h-72" />
      </div>
    );

  if (feed.status === "error" || pitchState.status === "error")
    return (
      <div>
        {header}
        <Card className="mt-6">
          <ErrorState
            message="We couldn't load today's schedule."
            onRetry={() => {
              retry();
              reloadPitches();
            }}
          />
        </Card>
      </div>
    );

  const pitches = pitchState.data.filter((pitch) => !pitch.archived);
  const bookings = feed.data;
  const stats = dayStats(bookings);
  const segments = pitches.map((pitch) => pitchSegments(bookings.filter((booking) => booking.pitch === pitch.name), OPEN, CLOSE));
  const freeSlots = freeSlotCount(segments, Math.max(nowMinutes, OPEN));
  const next = nextBooking(bookings, nowMinutes);
  const nextStart = next ? (timeToMinutes(next.startTime) ?? nowMinutes) : 0;
  const nextPitch = next ? pitchState.data.find((pitch) => pitch.name === next.pitch) : undefined;

  // Start the timeline at the first booking still to come (or an hour ago), so the busy part is in view
  const upcoming = bookings.map((booking) => timeToMinutes(booking.startTime)).filter((minute): minute is number => minute !== null && minute >= nowMinutes - 60);
  const focusMinute = upcoming.length > 0 ? Math.min(...upcoming) - 60 : nowMinutes - 60;

  return (
    <div>
      {header}

      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Bookings today" value={String(stats.bookings)} hint="Scheduled bookings" icon={<CalendarCheck className="size-3.5" />} />
        <StatCard label="Hours booked" value={`${formatHours(stats.hours)}h`} hint="Across all pitches" icon={<Clock className="size-3.5" />} />
        <StatCard label="Revenue today" value={formatAed(stats.revenue, currency)} hint="Today's total" icon={<TrendingUp className="size-3.5" />} />
        <StatCard label="Available slots" value={String(freeSlots)} hint="Open for booking" icon={<CircleCheck className="size-3.5" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <Card className="min-w-0 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Today's schedule</h2>
              <p className="mt-0.5 text-xs text-muted">
                Pitch availability from {openTime} to {closeTime}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sidebar px-2.5 py-1 text-xs text-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              Live schedule
            </span>
          </div>
          <div className="mt-4">
            {pitches.length === 0 ? (
              <EmptyState title="No pitches yet">Add your pitches in Settings to see the schedule.</EmptyState>
            ) : (
              <DaySchedule
                pitches={pitches}
                bookings={bookings}
                openMinutes={OPEN}
                closeMinutes={CLOSE}
                nowMinutes={nowMinutes}
                focusMinute={focusMinute}
                onFreeClick={(pitch, start, end) => {
                  // If it is happening right now, start from the next half hour instead of in the past
                  const nextHalfHour = Math.ceil(nowMinutes / 30) * 30;
                  const from = nowMinutes >= start && nextHalfHour < end ? nextHalfHour : start;
                  const slot = suggestedSlot({ start: from, end }, readDefaultDuration(browserStorage()));
                  openNew({ pitch: pitch.name, date: today, startTime: minutesToTime(slot.start), endTime: minutesToTime(slot.end) });
                }}
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Up next</h2>
          {next ? (
            <>
              <p className="mt-0.5 text-xs text-muted">Your next scheduled booking</p>
              <p className="mt-4 text-base font-semibold">{next.clientName}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                {next.startTime} ·{nextPitch ? <PitchTag name={nextPitch.name} color={nextPitch.color} /> : <span>{next.pitch}</span>}
              </p>
              <p className="mt-3 inline-block rounded-full bg-sidebar px-2.5 py-1 text-xs font-medium text-primary">{formatStartsIn(nextStart - nowMinutes)}</p>
              <Link to={`/bookings/${next.id}`} className="mt-4 flex h-10 items-center justify-center rounded-lg border border-line bg-surface text-sm font-semibold hover:bg-sidebar">
                View booking
              </Link>
            </>
          ) : (
            <EmptyState title="Nothing else today">No more bookings are scheduled for today.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}
