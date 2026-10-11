import { Card } from "@/components/ui/Card";
import { formatAed } from "@/lib/money";
import { MONTH_NAMES } from "@/lib/months";
import type { PitchRevenue } from "@/lib/dashboard";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";

const CURRENCY = DEFAULT_CENTER_SETTINGS.currency;

export function PitchRevenueCard({ rows, year, month, onMonth }: { rows: readonly PitchRevenue[]; year: number; month: number; onMonth: (month: number) => void }) {
  const max = Math.max(1, ...rows.map((row) => row.revenue));
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Revenue by pitch</h2>
          <p className="mt-0.5 text-xs text-muted">Highest earning pitches in {MONTH_NAMES[month]} {year}</p>
        </div>
        <select aria-label="Month" value={month} onChange={(event) => onMonth(Number(event.target.value))} className="h-9 rounded-lg border border-line bg-surface px-2 text-xs focus:border-primary">
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.pitch}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{row.pitch}</span>
              <span className="font-medium">{formatAed(row.revenue, CURRENCY)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sidebar" role="presentation">
              <div className="h-full rounded-full bg-primary" style={{ width: `${row.revenue > 0 ? Math.max(2, (row.revenue / max) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
