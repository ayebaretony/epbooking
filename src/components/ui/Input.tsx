import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  // Something shown inside the field on the right, e.g. the show/hide password button
  trailing?: ReactNode;
};

export function Input({ label, error, trailing, className = "", ...rest }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`h-11 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-primary ${
            error ? "border-danger" : "border-line"
          } ${trailing ? "pr-11" : ""} ${className}`}
          {...rest}
        />
        {trailing ? <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div> : null}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
