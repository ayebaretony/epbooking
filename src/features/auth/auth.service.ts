import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/types/models";

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function sendResetLink(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

// The users/{uid} document the owner created for this person. null when there is none yet (signing up alone grants
// nothing: the rules only let approved people in).
export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    role: data.role === "admin" ? "admin" : "staff",
    active: data.active === true,
  };
}
