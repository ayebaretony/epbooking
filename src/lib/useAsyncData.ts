import { useCallback, useEffect, useState } from "react";
import { fetchCached, queryCache } from "./queryCache";

export type AsyncData<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };

type Options<T> = {
  // Remember the result under this name, so other screens (and this one next time) can show it instantly
  cacheKey?: string;
  // A remembered result younger than this is used as it is, without asking the database again
  maxAgeMs?: number;
  // Something already known that can be shown while the real answer loads (for example a week taken from a loaded year)
  seed?: () => T | undefined;
};

type Result<T> = { key: string | undefined; value: { status: "ready"; data: T } | { status: "error" } };

// Loads something and keeps it up to date. With a cacheKey it shows what is remembered immediately and refreshes quietly in
// the background, so a screen that was open a moment ago appears at once with no loading boxes. `load` must be stable (a
// module-level function or useCallback), otherwise it would reload on every render. Every data screen shows loading, empty
// and error states from this (AGENTS.md section 4).
export function useAsyncData<T>(load: () => Promise<T>, options: Options<T> = {}): { state: AsyncData<T>; reload: () => void } {
  const { cacheKey, maxAgeMs = 0, seed } = options;
  const [result, setResult] = useState<Result<T> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const age = cacheKey ? queryCache.ageOf(cacheKey) : null;
    if (cacheKey && age !== null && age < maxAgeMs) return; // fresh enough: nothing to ask for
    const request = cacheKey ? fetchCached(cacheKey, load) : load();
    request.then(
      (data) => !cancelled && setResult({ key: cacheKey, value: { status: "ready", data } }),
      () => !cancelled && setResult({ key: cacheKey, value: { status: "error" } }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, cacheKey, maxAgeMs, attempt]);

  const reload = useCallback(() => {
    if (cacheKey) queryCache.markStale(cacheKey); // keep showing the old data while the new arrives
    setResult((current) => (current?.value.status === "error" ? null : current)); // but after an error, show loading again
    setAttempt((current) => current + 1);
  }, [cacheKey]);

  // What to show: what is remembered, else what this screen last loaded, else a seed, else the error or loading
  const remembered = cacheKey ? queryCache.get<T>(cacheKey) : undefined;
  const mine = result && result.key === cacheKey ? result.value : null;
  let state: AsyncData<T>;
  if (remembered !== undefined) state = { status: "ready", data: remembered };
  else if (mine?.status === "ready") state = mine;
  else {
    const seeded = seed?.();
    if (seeded !== undefined) state = { status: "ready", data: seeded };
    else state = mine ?? { status: "loading" };
  }
  return { state, reload };
}
