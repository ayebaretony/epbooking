// A small in-memory memory of what has been loaded, so moving between pages is instant instead of asking the database again.
// Screens show what is remembered straight away and quietly refresh it in the background ("stale while revalidate"). Anything
// that changes data throws away the matching memory (see invalidatePrefix), so a stale list never outlives an edit.
// Pure and dependency-free, so it is easy to test.

type Entry = { data: unknown; at: number };

const store = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();
// Bumped by every invalidation, so a request that was already in flight when the data changed cannot put old data back
let generation = 0;

export const queryCache = {
  get<T>(key: string): T | undefined {
    return store.get(key)?.data as T | undefined;
  },

  set(key: string, data: unknown): void {
    store.set(key, { data, at: Date.now() });
  },

  // How old the remembered value is, in milliseconds, or null if there is none
  ageOf(key: string): number | null {
    const entry = store.get(key);
    return entry ? Date.now() - entry.at : null;
  },

  // Keeps the remembered value (so a screen can keep showing it) but treats it as out of date, so the next ask reloads it
  markStale(key: string): void {
    const entry = store.get(key);
    if (entry) store.set(key, { ...entry, at: 0 });
    inFlight.delete(key);
  },

  delete(key: string): void {
    store.delete(key);
    inFlight.delete(key);
    generation++;
  },

  // Forget everything whose key starts with `prefix`: used after any change to bookings or pitches
  invalidatePrefix(prefix: string): void {
    for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
    for (const key of [...inFlight.keys()]) if (key.startsWith(prefix)) inFlight.delete(key);
    generation++;
  },

  clear(): void {
    store.clear();
    inFlight.clear();
    generation++;
  },

  // Entries whose key starts with `prefix` (so a screen can look for a bigger, already-loaded range)
  keysWithPrefix(prefix: string): string[] {
    return [...store.keys()].filter((key) => key.startsWith(prefix));
  },
};

// Loads and remembers a value. If the same key is already being loaded, everyone waits for that one request instead of
// sending another. A result that arrives after the key was invalidated is returned but not remembered.
export function fetchCached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const startedIn = generation;
  const request = load()
    .then((data) => {
      if (generation === startedIn) queryCache.set(key, data);
      return data;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

// Starts loading something in the background so it is ready when a screen asks. Never throws.
export function prefetch<T>(key: string, load: () => Promise<T>, maxAgeMs: number): void {
  const age = queryCache.ageOf(key);
  if (age !== null && age < maxAgeMs) return;
  fetchCached(key, load).catch(() => undefined);
}
