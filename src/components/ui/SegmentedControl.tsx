type Option<T extends string> = { value: T; label: string };

// A row of mutually exclusive choices, like Day | Week | Month
export function SegmentedControl<T extends string>({ options, value, onChange, label }: { options: readonly Option<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-sidebar p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${option.value === value ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
