import type { ReactNode } from "react";
import { Card } from "./Card";

// One number with a label and a short hint, as on the Today screen
export function StatCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-display font-bold leading-none">{value}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden="true" className="text-primary">
          {icon}
        </span>
        {hint}
      </p>
    </Card>
  );
}
