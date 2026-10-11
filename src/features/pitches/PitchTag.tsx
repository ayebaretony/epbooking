import { pitchStyles } from "./pitchStyles";

export function PitchTag({ name, color }: { name: string; color: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pitchStyles(color).tag}`}>{name}</span>;
}

export function ColorDot({ color, className = "" }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-3 rounded-full ${pitchStyles(color).dot} ${className}`} />;
}
