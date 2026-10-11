// Per-person conveniences kept on the device (localStorage), never in a shared Firestore document (AGENTS.md "Designs").

export const DURATION_OPTIONS = [30, 60, 90, 120, 180] as const;
export const DEFAULT_DURATION_MINUTES = 60;
const DURATION_KEY = "epbooking.defaultDurationMinutes";

// Storage can be missing or blocked (private windows), so every read falls back to the default.
export function readDefaultDuration(storage: Pick<Storage, "getItem"> | null): number {
  try {
    const stored = Number(storage?.getItem(DURATION_KEY));
    return (DURATION_OPTIONS as readonly number[]).includes(stored) ? stored : DEFAULT_DURATION_MINUTES;
  } catch {
    return DEFAULT_DURATION_MINUTES;
  }
}

export function saveDefaultDuration(storage: Pick<Storage, "setItem"> | null, minutes: number): void {
  try {
    if ((DURATION_OPTIONS as readonly number[]).includes(minutes)) storage?.setItem(DURATION_KEY, String(minutes));
  } catch {
    // Blocked storage just means the choice is not remembered
  }
}

// 30 -> "30 minutes", 60 -> "1 hour", 90 -> "1.5 hours"
export function formatDurationOption(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

// The browser's localStorage, or null where it is blocked (private windows) so callers fall back to the defaults
export function browserStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}
