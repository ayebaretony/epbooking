// The "PS" tile shown above the sign-in form on phones (from the auth design)
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white ${className}`}
    >
      PS
    </div>
  );
}
