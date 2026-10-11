import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { ToastContext, type ToastContextValue, type ToastKind } from "./ToastContext";

type Toast = { id: number; message: string; kind: ToastKind };
let nextId = 1;

// The small confirmation that appears bottom-right (above the tab bar on phones) and fades after a few seconds
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        {toasts.map((toast) => (
          <div key={toast.id} role="status" className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg">
            {toast.kind === "success" ? <CircleCheck className="size-4 text-success" aria-hidden="true" /> : <CircleAlert className="size-4 text-danger" aria-hidden="true" />}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
