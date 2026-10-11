import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthContext, type AuthContextValue, type AuthState } from "./AuthContext";
import { fetchProfile } from "./auth.service";

async function resolveState(user: User): Promise<AuthState> {
  try {
    const profile = await fetchProfile(user.uid);
    if (!profile) return { status: "noProfile", user };
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
      setState({ status: "loading" });
      const next = await resolveState(user);
      if (ticket === latest.current) setState(next);
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
