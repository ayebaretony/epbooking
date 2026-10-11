import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/StateMessages";
import { minutesToTime } from "@/lib/bookingMath";
import type { Utilisation } from "@/lib/dashboard";
import { WEEKDAY_SHORT } from "@/lib/months";

// Darker green = more bookings in that hour. Empty hours are the page tint.
function shade(count: number, max: number): string {
  if (count === 0) return "var(--color-sidebar)";
  return `color-mix(in srgb, var(--color-primary) ${Math.round(18 + (count / max) * 82)}%, white)`;
}

export function UtilisationCard({ grid, year }: { grid: Utilisation; year: number }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Pitch utilisation</h2>
      <p className="mt-0.5 text-xs text-muted">Bookings by day and time in {year}</p>
      {grid.hours.length === 0 ? (
        <EmptyState title="Nothing to show yet">Busy times appear once there are bookings.</EmptyState>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-separate border-spacing-1 text-center text-xs">
              <thead>
                <tr>
                  <td />
                  {WEEKDAY_SHORT.map((day) => (
                    <th key={day} scope="col" className="pb-1 font-medium text-muted">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.hours.map((hour, row) => (
                  <tr key={hour}>
                    <th scope="row" className="pr-1 text-right font-medium text-muted">
                      {minutesToTime(hour * 60)}
                    </th>
                    {grid.counts[row].map((count, day) => (
                      <td
                        key={day}
                        title={`${WEEKDAY_SHORT[day]} ${minutesToTime(hour * 60)}: ${count} ${count === 1 ? "booking" : "bookings"}`}
                        className="h-7 rounded-md"
                        style={{ backgroundColor: shade(count, grid.max) }}
                      >
                        <span className="sr-only">{count}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted" aria-hidden="true">
            Fewer
            {[0, 0.25, 0.5, 0.75, 1].map((step) => (
              <span key={step} className="size-4 rounded" style={{ backgroundColor: shade(step === 0 ? 0 : step * grid.max || 1, grid.max || 1) }} />
            ))}
            More
          </div>
        </>
      )}
    </Card>
  );
}
