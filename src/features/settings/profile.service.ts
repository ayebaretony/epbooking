import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// People can change only their own display name (the security rules allow nothing else on users/{uid}).
export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { displayName: displayName.trim() });
}
