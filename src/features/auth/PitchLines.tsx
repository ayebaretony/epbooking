// Faint football-pitch markings for the sign-in brand panel (decorative only, so hidden from screen readers)
export function PitchLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 700"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
      fill="none"
      stroke="rgba(255,255,255,0.12)"
      strokeWidth="1.5"
    >
      <rect x="24" y="30" width="352" height="640" rx="18" />
      <line x1="24" y1="350" x2="376" y2="350" />
      <circle cx="200" cy="350" r="62" />
      <path d="M24 270 a80 80 0 0 1 0 160" />
      <path d="M376 270 a80 80 0 0 0 0 160" />
    </svg>
  );
}
