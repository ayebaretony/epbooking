// Stand-in for screens that are built in later phases (AGENTS.md section 8)
export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 className="text-display font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">This screen is built in {phase}.</p>
    </div>
  );
}
