import { useState } from "react";
import { ChevronLeft, ChevronRight, MousePointerClick, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/StateMessages";
import { useBookingDrawer } from "@/features/bookings/useBookingDrawer";
import { useBookingsInRange } from "@/features/bookings/hooks/useBookingsInRange";
import { usePitches } from "@/features/pitches/usePitches";
import { DaySchedule } from "@/features/schedule/DaySchedule";
import { minutesToTime, timeToMinutes } from "@/lib/bookingMath";
import { formatDateWithDay, formatMonthYear, formatWeekRange } from "@/lib/dateFormat";
import { browserStorage, readDefaultDuration } from "@/lib/preferences";
import { suggestedSlot } from "@/lib/schedule";
import { addDays, minutesOfDay, monthGridDates, monthStart, todayInTimezone, weekDates } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { DEFAULT_CENTER_SETTINGS, bookingStatus } from "@/types/models";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

const { timezone, openTime, closeTime } = DEFAULT_CENTER_SETTINGS;
const OPEN = timeToMinutes(openTime) ?? 420;
const CLOSE = timeToMinutes(closeTime) ?? 1380;

type View = "day" | "week" | "month";
const VIEWS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

// Phones start on the day view and wider screens on the week view, as in the designs
function initialView(): View {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches ? "week" : "day";
}

function shift(date: string, view: View, direction: 1 | -1): string {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addDays(date, 7 * direction);
  return addDays(monthStart(date), direction === 1 ? 32 : -1); // somewhere in the next or previous month
}

export function CalendarPage() {
  const now = useNow();
  const today = todayInTimezone(timezone, now);
  const { openNew, version } = useBookingDrawer();
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState(today);
  const [pitchFilter, setPitchFilter] = useState("");

  // What is on screen decides what is loaded (a bounded range, never the whole collection)
  const days = view === "day" ? [date] : view === "week" ? weekDates(date) : monthGridDates(date);
  const from = days[0];
  const to = days[days.length - 1];
  const { state, reload } = useBookingsInRange(from, to, version);
  const { state: pitchState, reload: reloadPitches } = usePitches();

  const allPitches = pitchState.status === "ready" ? pitchState.data.filter((pitch) => !pitch.archived) : [];
  const pitches = pitchFilter ? allPitches.filter((pitch) => pitch.name === pitchFilter) : allPitches;
  const active = state.status === "ready" ? state.data.filter((booking) => bookingStatus(booking) !== "cancelled" && (!pitchFilter || booking.pitch === pitchFilter)) : [];

  const label = view === "day" ? formatDateWithDay(date) : view === "week" ? formatWeekRange(from, to) : formatMonthYear(date);
  const openDay = (day: string) => {
    setDate(day);
    setView("day");
  };

  const chip = (selected: boolean) =>
    `h-8 rounded-full border px-3 text-xs font-medium transition-colors ${selected ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:bg-sidebar"}`;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-display font-bold">Calendar</h1>
          <p className="mt-1 text-sm text-muted">Manage pitch availability and bookings</p>
        </div>
        <Button onClick={() => openNew({ date: view === "day" ? date : today, pitch: pitchFilter || undefined })} className="shrink-0">
          <Plus className="size-4" aria-hidden="true" />
          New booking
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(shift(date, view, -1))} aria-label={`Previous ${view}`} className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface hover:bg-sidebar">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setDate(today)} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-sidebar">
            Today
          </button>
          <button type="button" onClick={() => setDate(shift(date, view, 1))} aria-label={`Next ${view}`} className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface hover:bg-sidebar">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <h2 className="ml-1 text-base font-semibold" aria-live="polite">
            {label}
          </h2>
        </div>
        <SegmentedControl label="Calendar view" options={VIEWS} value={view} onChange={setView} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by pitch">
        <span className="text-xs text-muted">Filter:</span>
        <button type="button" aria-pressed={pitchFilter === ""} onClick={() => setPitchFilter("")} className={chip(pitchFilter === "")}>
          All pitches
        </button>
        {allPitches.map((pitch) => (
          <button key={pitch.id} type="button" aria-pressed={pitchFilter === pitch.name} onClick={() => setPitchFilter(pitch.name)} className={chip(pitchFilter === pitch.name)}>
            {pitch.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem] xl:items-start">
        <div className="min-w-0">
          {state.status === "loading" || pitchState.status === "loading" ? (
            <div role="status" aria-label="Loading calendar">
              <Skeleton className="h-80" />
            </div>
          ) : null}
          {state.status === "error" || pitchState.status === "error" ? (
            <Card>
              <ErrorState
                message="We couldn't load the calendar."
                onRetry={() => {
                  reload();
                  reloadPitches();
                }}
              />
            </Card>
          ) : null}
          {state.status === "ready" && pitchState.status === "ready" && allPitches.length === 0 ? (
            <Card>
              <EmptyState title="No pitches yet">Add your pitches in Settings to use the calendar.</EmptyState>
            </Card>
          ) : null}

          {state.status === "ready" && pitchState.status === "ready" && allPitches.length > 0 ? (
            <>
              {view === "day" ? (
                <Card className="p-4 md:p-5">
                  <DaySchedule
                    key={date}
                    pitches={pitches}
                    bookings={active.filter((booking) => booking.date === date)}
                    openMinutes={OPEN}
                    closeMinutes={CLOSE}
                    nowMinutes={date === today ? minutesOfDay(now, timezone) : null}
                    focusMinute={date === today ? minutesOfDay(now, timezone) - 60 : 16 * 60}
                    onFreeClick={(pitch, start, end) => {
                      const slot = suggestedSlot({ start, end }, readDefaultDuration(browserStorage()));
                      openNew({ pitch: pitch.name, date, startTime: minutesToTime(slot.start), endTime: minutesToTime(slot.end) });
                    }}
                  />
                </Card>
              ) : null}
              {view === "week" ? <WeekView dates={days} today={today} pitches={pitches} bookings={active} onOpenDay={openDay} onAdd={(pitch, day) => openNew({ pitch: pitch.name, date: day })} /> : null}
              {view === "month" ? <MonthView dates={days} month={date} today={today} pitches={allPitches} bookings={active} onOpenDay={openDay} /> : null}
            </>
          ) : null}
        </div>

        <Card className="hidden p-4 xl:block">
          <p className="flex items-start gap-2 text-sm text-muted">
            <MousePointerClick className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Click an empty slot to start a booking. Click a booking to see its details.
          </p>
        </Card>
      </div>
    </div>
  );
}
