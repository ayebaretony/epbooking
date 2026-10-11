// Remembers, on this device, who is signed in and whether they are approved, so the app can open straight away instead of
// waiting a second for the database to say so. The database is still asked every time, in the background, and if it
// disagrees (someone was switched off) the screen changes at once. This is only about how fast the screens appear: the
// security rules decide what anyone can actually read or change, whatever is stored here. Relative imports so it is testable.
import type { UserProfile } from "../../types/models.ts";

const key = (uid: string) => `epbooking.profile.${uid}`;

type ReadableStorage = Pick<Storage, "getItem"> | null;
type WritableStorage = Pick<Storage, "setItem" | "removeItem"> | null;

// Only a well-formed, approved profile comes back. Anything else (missing, damaged, not approved) is treated as unknown.
export function readCachedProfile(uid: string, storage: ReadableStorage): UserProfile | null {
  try {
    const raw = storage?.getItem(key(uid));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<UserProfile>;
    if (value.active !== true) return null;
    if (value.role !== "admin" && value.role !== "staff") return null;
    return { displayName: typeof value.displayName === "string" ? value.displayName : "", email: typeof value.email === "string" ? value.email : "", role: value.role, active: true };
  } catch {
    return null;
  }
}

export function cacheProfile(uid: string, profile: UserProfile, storage: WritableStorage): void {
  try {
    if (profile.active) storage?.setItem(key(uid), JSON.stringify(profile));
    else storage?.removeItem(key(uid));
  } catch {
    // Blocked storage just means the next start is not instant
  }
}

export function clearCachedProfile(uid: string, storage: WritableStorage): void {
  try {
    storage?.removeItem(key(uid));
  } catch {
    // nothing to do
  }
}
