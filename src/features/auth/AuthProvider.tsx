import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthContext, type AuthContextValue, type AuthState } from "./AuthContext";
import { browserStorage } from "@/lib/preferences";
import { fetchProfile } from "./auth.service";
import { cacheProfile, clearCachedProfile, readCachedProfile } from "./profileCache";

async function resolveState(user: User): Promise<AuthState> {
  try {
    const profile = await fetchProfile(user.uid);
    if (!profile) {
      clearCachedProfile(user.uid, browserStorage());
      return { status: "noProfile", user };
    }
    cacheProfile(user.uid, profile, browserStorage()); // remembers approved people, forgets anyone switched off
    return profile.active ? { status: "active", user, profile } : { status: "inactive", user, profile };
  } catch {
    return { status: "error", user };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  // Sign-ins can overlap (sign out and straight back in), so only the latest check may update the screen.
  const latest = useRef(0);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      const ticket = ++latest.current;
      if (!user) {
        setState({ status: "signedOut" });
        return;
      }
      // If this person was approved the last time on this device, open the app straight away instead of waiting for the
      // database to say so. It is still checked below, and the screen changes if the answer is different.
      const remembered = readCachedProfile(user.uid, browserStorage());
      setState(remembered ? { status: "active", user, profile: remembered } : { status: "loading" });
      const next = await resolveState(user);
      if (ticket !== latest.current) return;
      if (next.status === "error" && remembered) return; // offline or a hiccup: keep what is already showing
      setState(next);
    });
  }, []);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    const ticket = ++latest.current;
    const next = await resolveState(user);
    if (ticket === latest.current) setState(next);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, refresh }), [state, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
