// The fixed palette a pitch can pick from. Stored on pitches.color as the key; screens turn it into styles.
// The first four are the colours in the owner's designs (Fifa green, Airdome blue, Junior amber, Half purple).
export const PITCH_COLOR_KEYS = ["green", "blue", "amber", "purple", "rose", "teal"] as const;
export type PitchColorKey = (typeof PITCH_COLOR_KEYS)[number];

export function isPitchColorKey(value: string): value is PitchColorKey {
  return (PITCH_COLOR_KEYS as readonly string[]).includes(value);
}

// The next palette colour that no existing pitch uses (wraps round when all are taken)
export function nextUnusedColor(used: readonly string[]): PitchColorKey {
  return PITCH_COLOR_KEYS.find((key) => !used.includes(key)) ?? PITCH_COLOR_KEYS[used.length % PITCH_COLOR_KEYS.length];
}
