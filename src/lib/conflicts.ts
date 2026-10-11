// Slot-key logic behind double-booking prevention (AGENTS.md section 6).
// A reservation occupies one slot document per `slotMinutes` it covers. Two reservations for the same pitch and time
// need the same slot document, so the second one fails. Different pitches never share slot ids, so they may overlap.
// Times are minutes since midnight in the center timezone. This file is pure (no imports) so it is easy to test.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// 570 -> "0930"
export function toHHmm(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}`;
}

// "0930" -> 570
export function fromHHmm(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(2, 4));
}

// "Fifa Pitch" -> "fifa-pitch". Derived from the pitch name stored on each booking, so old bookings need no extra field.
export function pitchSlug(pitchName: string): string {
  return pitchName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slot document id: `${pitchSlug}_${date}_${HHmm}`
export function slotKey(pitchId: string, date: string, startMinutes: number): string {
  return `${pitchId}_${date}_${toHHmm(startMinutes)}`;
}

// Start of every slot a reservation covers. 18:00-19:30 with 30-minute slots -> [1080, 1110, 1140].
// The end time itself is not included, so back-to-back reservations never share a slot.
export function slotStarts(startMinutes: number, endMinutes: number, slotMinutes: number): number[] {
  const starts: number[] = [];
  for (let minute = startMinutes; minute < endMinutes; minute += slotMinutes) starts.push(minute);
  return starts;
}

// Every slot key for one reservation, ready to read and write in a transaction.
export function slotKeysFor(
  pitchId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
  slotMinutes: number,
): string[] {
  return slotStarts(startMinutes, endMinutes, slotMinutes).map((minute) => slotKey(pitchId, date, minute));
}

export function overlapsTaken(
  startMinutes: number,
  endMinutes: number,
  slotMinutes: number,
  taken: ReadonlySet<number>,
): boolean {
  return slotStarts(startMinutes, endMinutes, slotMinutes).some((minute) => taken.has(minute));
}
