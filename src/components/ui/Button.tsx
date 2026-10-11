import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "bg-surface text-ink border border-line hover:bg-sidebar",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "bg-transparent text-primary hover:bg-sidebar",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  // Shows a busy state and blocks double submits while something is saving
  loading?: boolean;
};

export function Button({ variant = "primary", loading = false, disabled, className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
