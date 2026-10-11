import { createContext } from "react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/types/models";

// Where the person is in the sign-in flow:
// - loading: checking whether someone is already signed in
// - signedOut: nobody
// - noProfile / inactive: signed in, but not approved (no users/{uid} document, or active is false)
// - active: signed in and approved, can use the app
// - error: couldn't check (e.g. offline), so a retry is offered
export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "noProfile"; user: User }
  | { status: "inactive"; user: User; profile: UserProfile }
  | { status: "active"; user: User; profile: UserProfile }
  | { status: "error"; user: User };

export type AuthContextValue = {
  state: AuthState;
  // Re-check the approval, e.g. after the owner activates the account
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
