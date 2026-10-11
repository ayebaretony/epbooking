import { useId, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label: string };

export function Select({ label, className = "", children, ...rest }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        className={`h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-primary disabled:cursor-not-allowed disabled:bg-sidebar disabled:text-muted ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
