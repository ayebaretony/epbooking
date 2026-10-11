import { collection, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { pitchSlug } from "@/lib/conflicts";
import type { Pitch } from "@/types/models";
import type { PitchInput } from "./pitch.validation";

// Components never talk to Firestore directly: they use this file (AGENTS.md section 4).

export async function listPitches(): Promise<Pitch[]> {
  const snapshot = await getDocs(collection(db, "pitches"));
  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      const pitch: Pitch = {
        id: entry.id,
        name: String(data.name ?? entry.id),
        description: String(data.description ?? ""),
        color: String(data.color ?? "green"),
        sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 999,
        archived: data.archived === true,
      };
      // Absent means "Not set": pitches have no fixed price
      if (typeof data.defaultRatePerHour === "number") pitch.defaultRatePerHour = data.defaultRatePerHour;
      return pitch;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function createPitch(input: PitchInput, existing: readonly Pitch[]): Promise<void> {
  const id = pitchSlug(input.name);
  // The id comes from the name, so check it is free rather than silently replacing a pitch
  if ((await getDoc(doc(db, "pitches", id))).exists()) throw new Error("A pitch with this name already exists.");
  const sortOrder = existing.reduce((highest, pitch) => Math.max(highest, pitch.sortOrder), 0) + 1;
  await setDoc(doc(db, "pitches", id), {
    name: input.name,
    description: input.description,
    color: input.color,
    sortOrder,
    archived: false,
    ...(input.defaultRatePerHour === null ? {} : { defaultRatePerHour: input.defaultRatePerHour }),
  });
}

// The name is never changed, because existing bookings refer to the pitch by name.
export async function updatePitch(id: string, input: PitchInput): Promise<void> {
  await updateDoc(doc(db, "pitches", id), {
    description: input.description,
    color: input.color,
    defaultRatePerHour: input.defaultRatePerHour === null ? deleteField() : input.defaultRatePerHour,
  });
}
