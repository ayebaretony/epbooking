import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAed } from "@/lib/money";
import { MONTH_NAMES } from "@/lib/months";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";

const CURRENCY = DEFAULT_CENTER_SETTINGS.currency;

// "AED 30k" on the axis, the exact figure in the tooltip
const short = (value: number) => (value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value));

export function RevenueByMonthChart({ monthly }: { monthly: readonly number[] }) {
  const data = monthly.map((revenue, index) => ({ month: MONTH_NAMES[index].slice(0, 3), revenue }));
  return (
    <>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="month" interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={short} tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
            <Tooltip
              cursor={{ fill: "var(--color-sidebar)" }}
              formatter={(value) => [formatAed(Number(value), CURRENCY), "Revenue"]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--color-line)", fontSize: 12 }}
            />
            <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* The same numbers as text, for screen readers */}
      <table className="sr-only">
        <caption>Revenue by month</caption>
        <tbody>
          {data.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.month}</th>
              <td>{formatAed(row.revenue, CURRENCY)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
