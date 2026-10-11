import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PitchTag } from "@/features/pitches/PitchTag";
import { pitchStyles } from "@/features/pitches/pitchStyles";
import { minutesToTime } from "@/lib/bookingMath";
import { formatAed } from "@/lib/money";
import { pitchSegments, type Segment } from "@/lib/schedule";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";
import type { Booking, Pitch } from "@/types/models";

const CURRENCY = DEFAULT_CENTER_SETTINGS.currency;
const HOUR_WIDTH = 96; // pixels per hour on the desktop timeline
const LABEL_WIDTH = 168; // the pitch name column

type Props = {
  pitches: readonly Pitch[];
  // All of the day's bookings, any pitch. They are split up per pitch here.
  bookings: readonly Booking[];
  openMinutes: number;
  closeMinutes: number;
  // The current time in minutes when this is today, to draw the "now" line. null for other days.
  nowMinutes: number | null;
  // Where the timeline should start scrolled to (it is wider than most screens)
  focusMinute: number;
  onFreeClick: (pitch: Pitch, start: number, end: number) => void;
};

const range = (start: number, end: number) => `${minutesToTime(start)}–${minutesToTime(end)}`;

export function DaySchedule(props: Props) {
  const rows = props.pitches.map((pitch) => ({
    pitch,
    segments: pitchSegments(props.bookings.filter((booking) => booking.pitch === pitch.name), props.openMinutes, props.closeMinutes),
  }));
  return (
    <>
      <div className="hidden md:block">
        <Timeline {...props} rows={rows} />
      </div>
      <div className="md:hidden">
        <PitchLists {...props} rows={rows} />
      </div>
    </>
  );
}

type Row = { pitch: Pitch; segments: Segment[] };

// Desktop: one row per pitch along a time axis. Wider than the screen, so it scrolls sideways.
function Timeline({ rows, openMinutes, closeMinutes, nowMinutes, focusMinute, onFreeClick }: Props & { rows: Row[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const trackWidth = ((closeMinutes - openMinutes) / 60) * HOUR_WIDTH;
  const x = (minute: number) => ((minute - openMinutes) / 60) * HOUR_WIDTH;

  useEffect(() => {
    // Start at the busy part of the day instead of at opening time
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, x(Math.max(openMinutes, focusMinute)) - 24);
    // Runs once when the schedule appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hourMarks: number[] = [];
  for (let minute = Math.ceil(openMinutes / 60) * 60; minute <= closeMinutes; minute += 60) hourMarks.push(minute);

  return (
    <div ref={scroller} className="overflow-x-auto" tabIndex={0} aria-label="Schedule, scrolls sideways">
      <div className="relative" style={{ width: LABEL_WIDTH + trackWidth }}>
        {/* Time axis */}
        <div className="flex border-b border-line text-xs text-muted">
          <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: LABEL_WIDTH }} />
          <div className="relative h-8" style={{ width: trackWidth }}>
            {hourMarks.map((minute) => (
              <span key={minute} className="absolute top-2 -translate-x-1/2" style={{ left: x(minute) }}>
                {minutesToTime(minute)}
              </span>
            ))}
          </div>
        </div>

        {rows.map(({ pitch, segments }) => (
          <div key={pitch.id} className="flex border-b border-line last:border-0">
            <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-1 border-r border-line bg-surface px-3 py-3" style={{ width: LABEL_WIDTH }}>
              <PitchTag name={pitch.name} color={pitch.color} />
              {pitch.description ? <span className="text-xs text-muted">{pitch.description}</span> : null}
            </div>
            <div
              className="relative h-[72px]"
              style={{
                width: trackWidth,
                backgroundImage: "linear-gradient(to right, var(--color-line) 1px, transparent 1px)",
                backgroundSize: `${HOUR_WIDTH}px 100%`,
              }}
            >
              {segments.map((segment) => {
                const style = { left: x(segment.start) + 2, width: Math.max(0, x(segment.end) - x(segment.start) - 4) };
                if (segment.kind === "free")
                  return (
                    <button
                      key={`free-${segment.start}`}
                      type="button"
                      onClick={() => onFreeClick(pitch, segment.start, segment.end)}
                      aria-label={`Book ${pitch.name} from ${range(segment.start, segment.end)}`}
                      className="absolute inset-y-2 flex items-center justify-center rounded-lg border border-dashed border-line bg-page text-xs text-muted hover:border-primary hover:bg-sidebar hover:text-primary"
                      style={style}
                    >
                      {style.width >= 72 ? "Free slot" : "+"}
                    </button>
                  );
                const { booking } = segment;
                return (
                  <Link
                    key={booking.id}
                    to={`/bookings/${booking.id}`}
                    aria-label={`${booking.clientName}, ${pitch.name}, ${range(segment.start, segment.end)}`}
                    className={`absolute inset-y-2 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs hover:brightness-95 ${pitchStyles(pitch.color).block}`}
                    style={style}
                  >
                    <p className="truncate font-semibold">{booking.clientName}</p>
                    <p className="truncate opacity-80">
                      {range(segment.start, segment.end)} · {formatAed(booking.totalPayment, CURRENCY)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* The current time */}
        {nowMinutes !== null && nowMinutes >= openMinutes && nowMinutes <= closeMinutes ? (
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-8 z-10 w-px bg-danger" style={{ left: LABEL_WIDTH + x(nowMinutes) }} />
        ) : null}
      </div>
    </div>
  );
}

// Phone: a card per pitch listing its bookings and free time in order
function PitchLists({ rows, onFreeClick }: Props & { rows: Row[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ pitch, segments }) => (
        <li key={pitch.id}>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <PitchTag name={pitch.name} color={pitch.color} />
              {pitch.description ? <span className="text-xs text-muted">{pitch.description}</span> : null}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {segments.map((segment) =>
                segment.kind === "free" ? (
                  <li key={`free-${segment.start}`}>
                    <button
                      type="button"
                      onClick={() => onFreeClick(pitch, segment.start, segment.end)}
                      aria-label={`Book ${pitch.name} from ${range(segment.start, segment.end)}`}
                      className="flex w-full items-center justify-between rounded-lg border border-dashed border-line bg-page px-3 py-2.5 text-left text-sm text-muted"
                    >
                      <span>{range(segment.start, segment.end)}</span>
                      <span>Free · tap to book</span>
                    </button>
                  </li>
                ) : (
                  <li key={segment.booking.id}>
                    <Link to={`/bookings/${segment.booking.id}`} className={`block rounded-lg border-l-4 px-3 py-2.5 ${pitchStyles(pitch.color).block}`}>
                      <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                        <span className="truncate">{segment.booking.clientName}</span>
                        <span className="shrink-0">{formatAed(segment.booking.totalPayment, CURRENCY)}</span>
                      </p>
                      <p className="text-xs opacity-80">{range(segment.start, segment.end)}</p>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </Card>
        </li>
      ))}
    </ul>
  );
}
