import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { signOut } from "@/features/auth/auth.service";
import { DURATION_OPTIONS, formatDurationOption, readDefaultDuration, saveDefaultDuration } from "@/lib/preferences";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function PreferencesCard() {
  // Kept on this device only. It will pre-select the length when a booking is created.
  const [duration, setDuration] = useState(() => readDefaultDuration(browserStorage()));

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Preferences</h2>
      <p className="mt-0.5 text-xs text-muted">Workspace defaults</p>
      <div className="mt-4 flex flex-col gap-4">
        <Select label="Currency" value={DEFAULT_CENTER_SETTINGS.currency} disabled onChange={() => undefined}>
          <option value={DEFAULT_CENTER_SETTINGS.currency}>{DEFAULT_CENTER_SETTINGS.currency}</option>
        </Select>
        <Select
          label="Default booking duration"
          value={duration}
          onChange={(event) => {
            const minutes = Number(event.target.value);
            setDuration(minutes);
            saveDefaultDuration(browserStorage(), minutes);
          }}
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDurationOption(minutes)}
            </option>
          ))}
        </Select>
        <Button variant="danger" onClick={() => void signOut()} className="w-full">
          Sign out
        </Button>
      </div>
    </Card>
  );
}
