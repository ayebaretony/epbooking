import { isPitchColorKey, type PitchColorKey } from "@/lib/pitchColors";

// Full class names are written out so Tailwind can see and generate them.
const STYLES: Record<PitchColorKey, { tag: string; dot: string }> = {
  green: { tag: "bg-pitch-green-tint text-pitch-green", dot: "bg-pitch-green" },
  blue: { tag: "bg-pitch-blue-tint text-pitch-blue", dot: "bg-pitch-blue" },
  amber: { tag: "bg-pitch-amber-tint text-pitch-amber", dot: "bg-pitch-amber" },
  purple: { tag: "bg-pitch-purple-tint text-pitch-purple", dot: "bg-pitch-purple" },
  rose: { tag: "bg-pitch-rose-tint text-pitch-rose", dot: "bg-pitch-rose" },
  teal: { tag: "bg-pitch-teal-tint text-pitch-teal", dot: "bg-pitch-teal" },
};

// An unknown colour falls back to green rather than breaking the screen
export function pitchStyles(color: string) {
  return STYLES[isPitchColorKey(color) ? color : "green"];
}
