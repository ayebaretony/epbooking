# AGENTS.md — Palace Sports Pitch Booking System (React rebuild)

Instructions for AI code agents working on this project. Read this fully before changing anything, and re-read the relevant section before each phase.

**Owner context:** the owner is a sports business owner, not a professional developer. Explain things in plain language, and give exact step-by-step instructions for anything done in the Firebase console or terminal. Never assume prior DevOps knowledge.

## 1. What this is, and where it stands

An internal management portal for **Palace Sports** (football pitch rental, prices in **AED**, timezone **Asia/Dubai**). The owner and staff book pitches and track revenue. There is no customer-facing booking.

There are two apps. Don't confuse them.

| | Legacy app (live today) | New React app (being built) |
|---|---|---|
| Where | https://ayebaretony.github.io/epbooking/ (`index.html` + `firebase-config.js` on `main`) | Local folder on the owner's internal disk (see §4), pushed to this repo on a `react-rebuild` branch |
| Stack | One HTML file, Firebase compat SDK from CDNs | React + TypeScript + Vite (see §4) |
| Data | Firestore collection `bookings` | **New** Firestore collections (see §5). `bookings` is left untouched |
| Auth | Fake (hard-coded in the page) | Real Firebase Authentication |

- **Firebase project (shared by both):** `pitchbookingsystem-6e222` (Cloud Firestore). The new app uses the **same project**, so the data stays where it is.
- **Reference project:** the owner's other app, **Servly** (`/Users/tony/Desktop/servly/servlycode`, a tennis court booking system), is the template for stack, folder structure, conventions, Firestore rules and the double-booking guard. Read its `AGENTS.md`, `firestore.rules` and `src/` before writing code, and reuse its patterns. Servly is read-only reference. Never edit it, and never copy its `.env.local` or touch its Firebase project (`servly-87915`).
- **Repo:** `ayebaretony/epbooking` (**public**). Never commit secrets, backups or data exports.

## 2. Prime directive: protect the production data

The Firestore database holds a year of real bookings and revenue history. **Losing, corrupting or silently reshaping it is the worst possible outcome.**

1. **Never** delete, overwrite, bulk-update or "migrate" documents in the live database without the owner's explicit approval in chat for that specific operation.
2. **The legacy `bookings` collection is read-only for all new work.** Never write to it, rename its fields or delete from it. It stays as the archive and the rollback path.
3. All new data goes into **new collections** (§5). Migration is a **copy**, never an in-place change.
4. Before anything that could affect data, run a fresh backup: `python3 scripts/backup_bookings.py`. It is read-only, pages through the whole collection, cross-checks the count and writes JSON into `backups/` (git-ignored, because it holds client personal data). The latest verified backup is `backups/bookings-20261010-202009.json` (482 documents).
5. Every migration or bulk-write script must be **idempotent** (safe to run twice), have a **`--dry-run`** mode, and **verify afterwards** (document counts and revenue totals must match the source). Show the owner the dry-run output before the real run.
6. Develop and test against the **Firebase Emulator Suite**, never against `pitchbookingsystem-6e222`. Load the backup into the emulator to test with realistic data.
7. Deploy only when asked. Work on branches, not on `main`.

## 3. Legacy data (what exists today)

Collection **`bookings`** in `pitchbookingsystem-6e222`, one document per booking, auto-generated IDs:

| Field | Type | Notes |
|---|---|---|
| `pitch` | string | `Fifa Pitch`, `Airdome`, `Junior Football Pitch`, `Half Pitch` |
| `clientName` | string | Free text |
| `contact` | string | Phone number (8 are empty) |
| `date` | string | `YYYY-MM-DD` (a string, not a Timestamp) |
| `startTime` / `endTime` | string | `HH:mm` (24h) |
| `pricePerHour` | number | AED, can have decimals (e.g. 527.1) |
| `hours` | number | Stored at write time |
| `totalPayment` | number | Stored at write time, AED |

**Verified against the backup of 2026-10-10 (482 documents):**
- Every document has exactly these nine fields, with consistent types. `totalPayment == hours * pricePerHour` for all of them.
- Dates run from **2025-04-02 to 2027-01-29**. **46 bookings are in the future** (recurring series).
- Pitch counts: Fifa Pitch 308, Airdome 107, Junior Football Pitch 44, Half Pitch 23.
- Opening hours in practice: **07:00 to 23:00**. Every start and end time is on a **30-minute grid**. Nothing runs past midnight.
- **No two bookings overlap on the same pitch.** There are **55 overlaps across different pitches** (Fifa Pitch with Airdome 33, with Junior 13, with Half Pitch 9). The business evidently allows them, so the double-booking rule is **per pitch** (§6).
- Conversion is lossless: all prices have at most 2 decimals, all totals are whole fils, all durations are whole minutes. Contacts are all phone numbers (no emails).
- Total revenue in the backup is about AED 497,908. Revenue totals must match after migration, to the fils.
- Prices vary (750, 600, 400, 650, 527.1, 224.07 and others). Never assume a flat rate.

This is a snapshot. Re-run the backup script before relying on it.

## 4. New React app

### Stack (approved, mirrors Servly)

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite + TypeScript (strict) |
| Styling | Tailwind CSS (design tokens defined once as theme tokens or CSS variables, never hard-coded hex in components) |
| Routing | React Router |
| Backend | Firebase **modular** SDK v9+: Auth + Firestore (never the compat API) |
| Dates | `date-fns` + `date-fns-tz` |
| Charts | Recharts |
| Icons | `lucide-react` |
| Local dev | Firebase Emulator Suite (Auth + Firestore) |
| Hosting | Firebase Hosting (free Spark plan). GitHub Pages can't serve client-side routes well. Confirm with the owner |

### Location and branching
- **The project lives on the owner's internal disk** at `~/Desktop/epbooking-react` (agreed 2026-10-10), because installs on the external exFAT drive are slow and macOS leaves `._*` files. The external drive (`/Volumes/Tony/footballbooking`) holds the legacy files, backups and this `AGENTS.md`.
- It is a git clone of this repo on a `react-rebuild` branch (started from the `docs/agents-md-and-backup-script` branch, so this file and `scripts/` are already here). `main` keeps serving the legacy site until cutover (§7).
- The legacy `index.html` and `firebase-config.js` were moved to `legacy/` on this branch so Vite can have its own root `index.html`. The live site is unaffected because it is served from `main`.
- **Phase 0 status (2026-10-10):** scaffold, config, emulator wiring, typed models and the pure logic helpers (`src/lib/money.ts`, `conflicts.ts`, `time.ts`) are in place, with `npm test`, `npm run build` and `npm run lint` passing. Colour tokens and UI primitives are **waiting for the owner's designs**.
- **There is deliberately no `.firebaserc` and no deploy script**, and `firestore.rules` is a deny-all placeholder. Deploying it to `pitchbookingsystem-6e222` would lock the live legacy app out. Add them only at cutover (§7), with the owner's go-ahead.
- Unit tests use Node's built-in runner (`npm test`, no extra dependency). Keep the logic in `src/lib` pure so it stays testable this way.
- The Firestore emulator needs **Java 17+**. It was not installed on the owner's Mac at the time of writing.

### Hard constraints
1. **Budget is zero.** Stay within the Firebase **Spark (free) plan**.
2. **No Cloud Functions** (they need the paid plan). Do logic in the client with Firestore transactions and security rules.
3. **No other paid or third-party backend services.** Ask first.
4. **No new dependencies without asking.** State what, why and its size, then wait. The Servly stack above is pre-approved.
5. **Never commit secrets.** The Firebase web config goes in `.env.local` (git-ignored), with `.env.example` committed (same pattern as Servly). The web API key is not a secret, but keep config out of source anyway.
6. **Don't invent features.** Suggest them at the end of a task instead.
7. **Match the owner's approved designs.** The UI is being designed by the owner (Flowstep and screenshots). Do not redesign. Until designs exist, build only unstyled or primitive components and the data and logic layers.

### Folder structure (same as Servly)
```
/src
  /app            router, providers, layout shell
  /components/ui  Button, Card, Badge, Input, Select, Modal, Table, StatCard, Skeleton, Toast
  /features       auth, dashboard, calendar, bookings, pitches, revenue, settings
  /lib            firebase.ts, money.ts, time.ts, conflicts.ts
  /types
firestore.rules  firestore.indexes.json  firebase.json  .env.example
/scripts          backup + migration (Node or Python), never run against production without approval
```
Feature folders own their hooks, components and Firestore queries. Components never call Firestore directly. They use hooks or a `*.service.ts` file.

### Working rules
- **Work in phases** (§8). Finish and verify one before the next. **Before coding a phase, post a short plan** (files to change, data touched). **After, summarise** what was built and how to test it.
- One screen or feature per task. Don't touch unrelated files.
- TypeScript strict, no `any` without a comment saying why.
- Every data screen has **loading (skeleton), empty (friendly message plus action) and error (message plus retry)** states.
- Forms: validate before submit, inline errors, disable submit while saving, success toast. **Confirm destructive actions** with a modal.
- Run `npm run build` and `npm run lint` before declaring a task done.
- When something is ambiguous, ask one clear question rather than guessing.
- Keep code boring and readable: small functions, clear names, short comments explaining *why*.
- Don't put real client names, phone numbers or emails in code, tests, screenshots, commits or chat. Use fake data (`Test Client`, `+971500000000`). Don't log customer details to the console.

## 5. New data model (new collections in the same Firebase project)

Collection names deliberately differ from the legacy `bookings`, so the old data and the old site stay untouched.

```
users/{uid}          displayName, email, role "admin"|"staff", active (bool), createdAt
pitches/{pitchId}    name, surface, status "available"|"maintenance", color, sortOrder, archived
reservations/{id}    pitchId, pitchName, customerName, customerPhone, customerEmail|null,
                     date "YYYY-MM-DD" (Asia/Dubai), startAt, endAt (Timestamps), durationMinutes,
                     hourlyRateMinor, totalMinor (integers, fils), status "confirmed"|"pending"|"cancelled",
                     notes|null, createdBy, createdAt, updatedAt
                     optional: seriesId (recurring), legacyId, source ("legacy-import")
slots/{pitchId}_{date}_{HHmm}   one doc per occupied 30-minute slot: pitchId, date, reservationId|null, blockId|null
blocks/{blockId}     pitchId, startAt, endAt, reason, createdBy
settings/center      centerName, currency "AED", timezone "Asia/Dubai", openTime "07:00", closeTime "23:00", slotMinutes 30
settings/security    idleTimeoutMinutes
```

Differences from Servly: courts are **pitches** (`pitchId`/`pitchName`), the bookings collection is **`reservations`**, and **`closeTime` is `23:00`** (Servly's 22:00 would reject real bookings).

### Money and time rules
- Store money as **integer fils** (100 fils = 1 AED). Never floats. Format only through the shared formatter in `lib/money.ts` (`Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })`).
- `totalMinor` is a snapshot. **Never recompute it later**, because historic totals must not change. For new bookings, total = `Math.round(hourlyRateMinor * durationMinutes / 60)`.
- Pitches have **no price**. The hourly rate is typed on each booking, as in the legacy app.
- Timestamps are UTC. "Today", "this month" etc. are computed in `Asia/Dubai`. The `date` string is the start date in that timezone and is the field used for range queries.

### Legacy to new mapping (the migration)

| Legacy `bookings` | New `reservations` |
|---|---|
| doc ID | **same ID** (makes the migration idempotent), also stored as `legacyId` |
| `pitch` (name) | `pitchId` (slug, e.g. `fifa-pitch`) + `pitchName`. Seed the 4 `pitches` docs first |
| `clientName` | `customerName` |
| `contact` | `customerPhone` (all current values are phone numbers). Empty stays `""`. `customerEmail: null` |
| `date` | `date` (unchanged) |
| `date` + `startTime` / `endTime` | `startAt` / `endAt` (Asia/Dubai to UTC) |
| `hours` | `durationMinutes = round(hours * 60)` |
| `pricePerHour` | `hourlyRateMinor = round(pricePerHour * 100)` |
| `totalPayment` | `totalMinor = round(totalPayment * 100)` (copied, **not** recomputed) |
| (none) | `status: "confirmed"`, `notes: null`, `createdBy: "legacy-import"`, `source: "legacy-import"`, `createdAt` / `updatedAt` = migration time |

Plus slot docs for each migrated reservation, so the double-booking guard also covers old and future bookings. The script must **report** any slot collision instead of failing, and verify: reservation count, sum of `totalMinor` equal to the legacy sum, and slot count equal to the total number of 30-minute slots.

## 6. Double-booking guard (critical)

Same design as Servly, applied **per pitch**:

1. Compute every slot key the reservation covers: `${pitchId}_${date}_${HHmm}` at 30-minute granularity.
2. In one `runTransaction`, read all of those slot docs. **If any exists, abort** with "That time is no longer available". Otherwise write the reservation and all its slot docs together.
3. Cancelling or editing deletes or rewrites the slot docs in the same transaction. Maintenance blocks write slot docs too.
4. Security rules also reject creating a slot doc that already exists (no `update` on slots).
5. Different pitches may overlap in time, because the current data shows the business allows it (§3). Whether `Half Pitch` physically shares space with `Fifa Pitch` is an **open decision** (§9).
6. Recurring bookings are **in scope** (the legacy app has them and 46 future bookings came from them): create N independent reservations, each through the transaction, sharing an optional `seriesId`. Show the owner which dates conflict instead of silently skipping them.
7. Test: overlapping times, back-to-back (allowed), same time on different pitches (allowed), cancel then rebook (allowed), two simultaneous attempts (one must fail).

## 7. Auth, security and cutover

- Firebase Auth: email/password (Google sign-in optional, copy Servly). **Signing up does not grant access.** Only users with a `users/{uid}` doc with `active: true` and a valid role get in. Roles: **admin** (everything) and **staff** (create, edit and cancel reservations, view dashboards). The **first admin** is created by hand in the Firebase console (give the owner step-by-step instructions).
- Write `firestore.rules` for real, based on Servly's file: deny by default, role checks per collection, field validation, slots create-only, nobody can change their own role. **Never `allow read, write: if true`.** Test the rules in the emulator, including attempts that must fail.

**Current exposure:** the live rules are `allow read, write;` with no condition (confirmed 2026-10-10). Anyone who knows the project ID (it is in the public repo) can read, change and delete all bookings and client phone numbers. Deploying new rules is what closes this, and the **new rules will also lock the legacy site and the legacy `bookings` collection** (the legacy app has no sign-in). So this is a **cutover**, not a drop-in change. Do not deploy locked rules before the new app is ready.

**Cutover sequence (each step needs the owner's go-ahead):**
1. New app tested on the emulator with the backup loaded. Staff accounts and the first admin `users` doc created in the console.
2. Staff stop using the legacy app (announce a time).
3. Fresh backup, then run the migration against production **while the old rules are still in place** (dry run first, then real run, then verify counts and revenue totals).
4. Deploy the new `firestore.rules` and the new app to Firebase Hosting together.
5. Replace the legacy GitHub Pages `index.html` with a notice and link to the new app. The old hard-coded password stays in public git history, so treat it as compromised and never reuse it.
6. Keep the legacy `bookings` collection untouched as an archive for at least 3 months.

Don't print, log or copy the old credentials anywhere.

## 8. Build phases

Because the data is exposed until cutover, **get to cutover quickly**. Do the dashboard and revenue polish after it.

- **Phase 0, Setup:** project on the internal disk, Vite + React + TS + Tailwind, Firebase emulators, `.env.example`, `firebase.json`, design tokens (from the owner's designs), UI primitives. Port `scripts/` and this file.
- **Phase 1, Auth and shell:** login, auth guard, approval-pending screen, sidebar and topbar, `users` handling, first-draft `firestore.rules` plus rules tests.
- **Phase 2, Pitches and settings:** pitches list and edit (status, colour), seed `settings/center` (07:00 to 23:00, 30-minute slots, `Asia/Dubai`, AED).
- **Phase 3, Reservations:** new, edit and cancel modal with the **transactional conflict guard**, recurring bookings, list with filters, search, cursor pagination, CSV and Excel export. **Write the migration script and tests here** (copy the backup into the emulator, verify totals).
- **Phase 4, Calendar:** month, week and day views, pitch colour legend, day panel, click-to-create, maintenance blocks. **Cutover (§7) can happen after this phase**, with the owner's go-ahead.
- **Phase 5, Dashboard:** stat cards, today's timeline, revenue this month, recent reservations. Include the existing "top repeat clients" and "pitch earnings" views.
- **Phase 6, Revenue and reports:** revenue by day, week, month and pitch, plus the PDF performance report the legacy app produced. (The legacy "AI Analysis" is template text, not real AI. Don't claim otherwise.)
- **Phase 7, Hardening:** rules review and tests, index check, quota check, accessibility pass, empty-data walkthrough, handover notes.

**Query discipline (Spark limits):** always query by a bounded date range, never load whole collections, paginate lists with `limit()` and `startAfter()`, use `getCountFromServer()` for totals, use `onSnapshot` only for today's view, cache pitches and settings, and commit composite indexes in `firestore.indexes.json`.

**Definition of done:** matches the design, has loading, empty and error states, works on a phone-width screen, shows no hard-coded data, formats all money in AED through the shared formatter, `npm run build` and `npm run lint` pass, queries are bounded and indexed, and security rules cover every new collection or field.

## 9. Decisions and business rules (confirm with the owner, don't assume)

Defaults are in italics and should sit behind settings so they're easy to change.

- Data approach: **copy into new collections** (decided 2026-10-10). Project folder: **internal disk** (decided 2026-10-10).
- Hosting: *Firebase Hosting*. Deploy branch for the legacy site: `main`.
- Do `Half Pitch` and `Fifa Pitch` (or any other pair) physically share space and need to block each other? *No: conflicts are per pitch only, matching current data.*
- Opening hours: *07:00 to 23:00*. Are bookings past midnight allowed? *No.*
- What counts as revenue? *Confirmed reservations only. Pending shown separately, cancelled excluded.*
- Statuses (`confirmed`, `pending`, `cancelled`), payments and deposits tracking, a separate clients collection: *not in the first version* (customer details stay on each reservation, as today).
- When to cut over: *after Phase 4*, or later if the owner needs the dashboard first. The longer it waits, the longer the data stays exposed.
- Staff accounts needed (how many, any beyond the owner): _unknown_.
- Cancellation, deposit and peak-pricing policy: _unknown_.

## 10. Quick reference

- Backup: `python3 scripts/backup_bookings.py` (read-only, output in git-ignored `backups/`).
- Firestore console: https://console.firebase.google.com/project/pitchbookingsystem-6e222
- Legacy site (until cutover): https://ayebaretony.github.io/epbooking/
- This external drive creates macOS `._*` files, which are git-excluded locally. If git reports `non-monotonic index` errors, delete any `._*` files under `.git/`.
- When you finish a task, update this file if you changed the architecture, data model or a decision.
