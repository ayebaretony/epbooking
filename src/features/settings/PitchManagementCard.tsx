import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/StateMessages";
import { useAuth } from "@/features/auth/useAuth";
import { PitchFormModal } from "@/features/pitches/PitchFormModal";
import { PitchTag } from "@/features/pitches/PitchTag";
import { usePitches } from "@/features/pitches/usePitches";
import { formatRate, aedToFils } from "@/lib/money";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";
import type { Pitch } from "@/types/models";

// "AED 750/hr", or "Not set" because pitches have no fixed price: each client's rate is negotiated per booking
function priceText(pitch: Pitch): string {
  return pitch.defaultRatePerHour === undefined ? "Not set" : formatRate(aedToFils(pitch.defaultRatePerHour), DEFAULT_CENTER_SETTINGS.currency);
}

export function PitchManagementCard() {
  const { state: auth } = useAuth();
  const isAdmin = auth.status === "active" && auth.profile.role === "admin";
  const { state, reload } = usePitches();
  // undefined = dialog closed, null = adding a new pitch, a Pitch = editing it
  const [dialog, setDialog] = useState<Pitch | null | undefined>(undefined);

  const pitches = state.status === "ready" ? state.data : [];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Pitch management</h2>
          <p className="mt-0.5 text-xs text-muted">Pitches and their optional default prices</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setDialog(null)} className="shrink-0">
            <Plus className="size-4" aria-hidden="true" />
            Add pitch
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading pitches">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10" />
            ))}
          </div>
        ) : null}
        {state.status === "error" ? <ErrorState message="We couldn't load the pitches." onRetry={reload} /> : null}
        {state.status === "ready" && pitches.length === 0 ? (
          <EmptyState title="No pitches yet">{isAdmin ? "Add your first pitch to get started." : "Ask an admin to add the pitches."}</EmptyState>
        ) : null}
        {state.status === "ready" && pitches.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="py-2 pr-2 font-medium">Pitch</th>
                <th scope="col" className="py-2 pr-2 font-medium">Default price</th>
                {isAdmin ? <th scope="col" className="py-2 text-right font-medium">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch) => (
                <tr key={pitch.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-2">
                    <PitchTag name={pitch.name} color={pitch.color} />
                    {pitch.description ? <p className="mt-1 text-xs text-muted">{pitch.description}</p> : null}
                  </td>
                  <td className={`py-3 pr-2 ${pitch.defaultRatePerHour === undefined ? "text-muted" : ""}`}>{priceText(pitch)}</td>
                  {isAdmin ? (
                    <td className="py-3 text-right">
                      <button type="button" onClick={() => setDialog(pitch)} aria-label={`Edit ${pitch.name}`} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-sidebar">
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-muted">Prices are agreed with each client, so every booking has its own price. A default here only fills in the price box.</p>

      {dialog !== undefined ? <PitchFormModal pitch={dialog} existing={pitches} onClose={() => setDialog(undefined)} onSaved={reload} /> : null}
    </Card>
  );
}
