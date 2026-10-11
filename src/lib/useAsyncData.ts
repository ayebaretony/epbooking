import { useCallback, useEffect, useState } from "react";

export type AsyncData<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };

// Loads something once and again on demand. `load` must be stable (a module-level function or useCallback), otherwise it
// would reload on every render. Every data screen shows loading, empty and error states from this (AGENTS.md section 4).
export function useAsyncData<T>(load: () => Promise<T>): { state: AsyncData<T>; reload: () => void } {
  const [state, setState] = useState<AsyncData<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ status: "ready", data }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, version]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion((current) => current + 1);
  }, []);

  return { state, reload };
}
