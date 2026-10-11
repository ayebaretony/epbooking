import { isPitchColorKey, type PitchColorKey } from "@/lib/pitchColors";

// Full class names are written out so Tailwind can see and generate them.
// tag = the small label, dot = a colour dot, block = a booking on a schedule (tinted, with a coloured left edge)
const STYLES: Record<PitchColorKey, { tag: string; dot: string; block: string }> = {
  green: { tag: "bg-pitch-green-tint text-pitch-green", dot: "bg-pitch-green", block: "border-pitch-green bg-pitch-green-tint text-pitch-green" },
  blue: { tag: "bg-pitch-blue-tint text-pitch-blue", dot: "bg-pitch-blue", block: "border-pitch-blue bg-pitch-blue-tint text-pitch-blue" },
  amber: { tag: "bg-pitch-amber-tint text-pitch-amber", dot: "bg-pitch-amber", block: "border-pitch-amber bg-pitch-amber-tint text-pitch-amber" },
  purple: { tag: "bg-pitch-purple-tint text-pitch-purple", dot: "bg-pitch-purple", block: "border-pitch-purple bg-pitch-purple-tint text-pitch-purple" },
  rose: { tag: "bg-pitch-rose-tint text-pitch-rose", dot: "bg-pitch-rose", block: "border-pitch-rose bg-pitch-rose-tint text-pitch-rose" },
  teal: { tag: "bg-pitch-teal-tint text-pitch-teal", dot: "bg-pitch-teal", block: "border-pitch-teal bg-pitch-teal-tint text-pitch-teal" },
};

// An unknown colour falls back to green rather than breaking the screen
export function pitchStyles(color: string) {
  return STYLES[isPitchColorKey(color) ? color : "green"];
}
