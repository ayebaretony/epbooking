import type { HTMLAttributes } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(18,26,20,0.04)] ${className}`} {...rest} />;
}
