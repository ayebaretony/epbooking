import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // "dialog" is a centred box; "drawer" slides in from the right on desktop and fills the screen on phones
  variant?: "dialog" | "drawer";
};

// A dialog built on the browser's own <dialog>, which traps keyboard focus and closes on Escape. Mounting it opens it;
// the parent unmounts it from onClose.
export function Modal({ title, onClose, children, variant = "dialog" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // Put the cursor in the first field, so people can start typing straight away. (React's own autoFocus runs before
    // the dialog is open, so it can't do this.)
    dialog.querySelector<HTMLElement>("input:not([disabled]):not([type=radio]):not([type=hidden]), textarea, select")?.focus();
  }, []);

  const shape =
    variant === "drawer"
      ? "m-0 ml-auto h-dvh max-h-dvh w-full max-w-md rounded-none md:rounded-l-xl"
      : "m-auto max-h-[90dvh] w-[min(92vw,28rem)] rounded-xl";

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed area outside the box (the dialog element itself) closes it
        if (event.target === ref.current) onClose();
      }}
      className={`${shape} border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40 open:flex open:flex-col`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-sidebar hover:text-ink">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
