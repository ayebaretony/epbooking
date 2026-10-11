import { useState } from "react";
import { CalendarDays, ClipboardList, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, ErrorState } from "@/components/ui/StateMessages";
import { useBookingDrawer } from "@/features/bookings/useBookingDrawer";
import { useBookingYears } from "@/features/bookings/hooks/useBookingYears";
import { usePitches } from "@/features/pitches/usePitches";
import { bestMonth, latestMonthWithBookings, monthRevenue, previousMonth, revenueByMonth, revenueByPitch, topRepeatClients, utilisation, yearSummary } from "@/lib/dashboard";
import { changeRatio, formatAed, formatPercentChange } from "@/lib/money";
import { MONTH_NAMES } from "@/lib/months";
import { todayInTimezone } from "@/lib/time";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";
import { PitchRevenueCard } from "./PitchRevenueCard";
import { RevenueByMonthChart } from "./RevenueByMonthChart";
import { TopClientsCard } from "./TopClientsCard";
import { UtilisationCard } from "./UtilisationCard";
import { useDashboardData } from "./useDashboardData";

const { currency, timezone } = DEFAULT_CENTER_SETTINGS;

export function DashboardPage() {
  const today = todayInTimezone(timezone);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;
  const { version } = useBookingDrawer();
  const years = useBookingYears(currentYear);
  const [year, setYear] = useState(currentYear);
  const [pickedMonth, setPickedMonth] = useState<number | null>(null);
  const { state, reload } = useDashboardData(year, version);
  const { state: pitchState } = usePitches();

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-display font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Performance overview</p>
      </div>
      <select
        aria-label="Year"
        value={year}
        onChange={(event) => {
          setYear(Number(event.target.value));
          setPickedMonth(null);
        }}
        className="h-10 rounded-lg border border-line bg-surface px-3 text-sm focus:border-primary"
      >
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );

  if (state.status === "loading")
    return (
      <div>
        {header}
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4" role="status" aria-label="Loading dashboard">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-4 h-80" />
      </div>
    );
  if (state.status === "error")
    return (
      <div>
        {header}
        <Card className="mt-6">
          <ErrorState message="We couldn't load the dashboard." onRetry={reload} />
        </Card>
      </div>
    );

  const bookings = state.data;
  const summary = yearSummary(bookings, year);
  const monthly = revenueByMonth(bookings, year);
  const viewingCurrentYear = year === currentYear;

  // The second card follows the design ("This month" with the change on last month) for the current year. For other years there
  // is no "this month", so it shows the best month instead.
  let monthCard: { label: string; value: string; hint: React.ReactNode };
  if (viewingCurrentYear) {
    const [prevYear, prevMonth] = previousMonth(year, currentMonth);
    const thisMonth = monthRevenue(bookings, year, currentMonth);
    const ratio = changeRatio(thisMonth, monthRevenue(bookings, prevYear, prevMonth));
    monthCard = {
      label: "This month",
      value: formatAed(thisMonth, currency),
      hint: ratio === null ? "No revenue last month to compare with" : <span className={ratio < 0 ? "text-danger" : "text-success"}>{formatPercentChange(ratio)} vs last month</span>,
    };
  } else {
    const best = bestMonth(monthly);
    monthCard = { label: "Best month", value: best ? formatAed(best.revenue, currency) : "—", hint: best ? MONTH_NAMES[best.month] : "No revenue this year" };
  }

  const pitches = pitchState.status === "ready" ? pitchState.data : [];
  const pitchNames = [...new Set([...pitches.map((pitch) => pitch.name), ...bookings.filter((b) => b.date.startsWith(`${year}-`)).map((b) => b.pitch)])];
  const month = pickedMonth ?? (viewingCurrentYear ? currentMonth : (latestMonthWithBookings(bookings, year) ?? 0));
  const hasBookings = summary.bookings > 0;

  return (
    <div>
      {header}

      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total revenue" value={formatAed(summary.revenue, currency)} hint={`Confirmed bookings in ${year}`} icon={<TrendingUp className="size-3.5" />} />
        <StatCard label={monthCard.label} value={monthCard.value} hint={monthCard.hint} icon={<CalendarDays className="size-3.5" />} />
        <StatCard label="Bookings" value={String(summary.bookings)} hint="Total bookings" icon={<ClipboardList className="size-3.5" />} />
        <StatCard label="Average booking" value={summary.averageBooking === null ? "—" : formatAed(summary.averageBooking, currency)} hint="Per booking" icon={<Wallet className="size-3.5" />} />
      </div>

      {!hasBookings ? (
        <Card className="mt-4">
          <EmptyState title={`No bookings in ${year} yet`}>Numbers appear here as soon as there are bookings.</EmptyState>
        </Card>
      ) : (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Card className="min-w-0 p-5">
              <h2 className="text-base font-semibold">Revenue by month</h2>
              <p className="mt-0.5 text-xs text-muted">AED revenue across {year}</p>
              <div className="mt-4">
                <RevenueByMonthChart monthly={monthly} />
              </div>
            </Card>
            <PitchRevenueCard rows={revenueByPitch(bookings, year, month, pitchNames)} year={year} month={month} onMonth={setPickedMonth} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <TopClientsCard rows={topRepeatClients(bookings, year)} year={year} />
            <UtilisationCard grid={utilisation(bookings, year)} year={year} />
          </div>
        </>
      )}
    </div>
  );
}
