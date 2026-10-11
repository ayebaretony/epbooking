// Tiny Firestore REST helper for the one-off scripts (no extra packages). It can READ any collection, and it can only
// WRITE where the owner's rules in AGENTS.md section 2 allow:
//   - `slots` and `pitches`, on the emulator or production (always create-only: an existing document is never overwritten),
//   - `bookings`, on the EMULATOR only (to load a backup for local testing). Production `bookings` is never written.
export type Target = { name: "emulator" | "production"; docs: string; headers: Record<string, string> };

export const EMULATOR: Target = {
  name: "emulator",
  docs: "http://127.0.0.1:8080/v1/projects/demo-epbooking/databases/(default)/documents",
  // "owner" is the emulator's admin token: it bypasses the rules, like the console would
  headers: { Authorization: "Bearer owner" },
};

export const PRODUCTION: Target = {
  name: "production",
  docs: "https://firestore.googleapis.com/v1/projects/pitchbookingsystem-6e222/databases/(default)/documents",
  headers: {},
};

export type Plain = string | number | boolean | null;
export type PlainDoc = { id: string; data: Record<string, Plain> };

function toValue(value: Plain) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
}

function fromValue(value: Record<string, unknown>): Plain {
  if ("stringValue" in value) return value.stringValue as string;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue as boolean;
  if ("timestampValue" in value) return value.timestampValue as string; // kept as text; the scripts don't need dates
  return null;
}

async function call(target: Target, url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, headers: { ...target.headers, "Content-Type": "application/json", ...init.headers } });
  } catch (error) {
    throw new Error(`Could not reach ${target.name} Firestore (${(error as Error).message}).${target.name === "emulator" ? " Is `npm run emulators` running?" : ""}`, { cause: error });
  }
}

export async function listCollection(target: Target, collection: string): Promise<PlainDoc[]> {
  const out: PlainDoc[] = [];
  let pageToken = "";
  do {
    const response = await call(target, `${target.docs}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`);
    if (!response.ok) throw new Error(`Reading ${collection} from ${target.name} failed: ${response.status} ${await response.text()}`);
    const page = (await response.json()) as { documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[]; nextPageToken?: string };
    for (const doc of page.documents ?? []) {
      out.push({
        id: doc.name.slice(doc.name.lastIndexOf("/") + 1),
        data: Object.fromEntries(Object.entries(doc.fields ?? {}).map(([key, value]) => [key, fromValue(value)])),
      });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const WRITABLE = ["slots", "pitches", "bookings"];

// Creates documents that do NOT exist yet. If any document in a batch already exists, that batch is refused whole, so
// nothing is ever overwritten. Callers skip existing ids first, which makes re-running safe.
export async function createOnly(target: Target, collection: string, docs: PlainDoc[]): Promise<void> {
  if (!WRITABLE.includes(collection)) throw new Error(`Refusing to write to "${collection}".`);
  if (collection === "bookings" && target.name !== "emulator") throw new Error("Refusing to write bookings anywhere except the emulator.");

  const project = target.docs.slice(target.docs.indexOf("/projects/") + 1, target.docs.indexOf("/databases"));
  for (let i = 0; i < docs.length; i += 400) {
    const writes = docs.slice(i, i + 400).map(({ id, data }) => ({
      update: {
        name: `${project}/databases/(default)/documents/${collection}/${id}`,
        fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toValue(value)])),
      },
      currentDocument: { exists: false },
    }));
    const response = await call(target, `${target.docs}:commit`, { method: "POST", body: JSON.stringify({ writes }) });
    if (!response.ok) throw new Error(`Writing ${collection} to ${target.name} failed: ${response.status} ${await response.text()}`);
  }
}

export async function clearEmulator(): Promise<void> {
  const response = await call(EMULATOR, "http://127.0.0.1:8080/emulator/v1/projects/demo-epbooking/databases/(default)/documents", { method: "DELETE" });
  if (!response.ok) throw new Error(`Could not clear the emulator: ${response.status}`);
}
