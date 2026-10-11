import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/StateMessages";
import { formatAed } from "@/lib/money";
import type { ClientRow } from "@/lib/dashboard";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";

const CURRENCY = DEFAULT_CENTER_SETTINGS.currency;

export function TopClientsCard({ rows, year }: { rows: readonly ClientRow[]; year: number }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Top repeat clients</h2>
      <p className="mt-0.5 text-xs text-muted">Most frequent clients in {year}</p>
      {rows.length === 0 ? (
        <EmptyState title="No repeat clients yet">Clients with more than one booking will appear here.</EmptyState>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-2 pr-2 font-medium">Client</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Bookings</th>
              <th scope="col" className="py-2 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-line last:border-0">
                <td className="py-3 pr-2 font-medium">{row.name}</td>
                <td className="py-3 pr-2 text-right">{row.bookings}</td>
                <td className="py-3 text-right">{formatAed(row.revenue, CURRENCY)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
