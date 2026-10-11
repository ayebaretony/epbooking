# AGENTS.md — Palace Sports Pitch Booking System (React rebuild)

Instructions for AI code agents working on this project. Read this fully before changing anything, and re-read the relevant section before each phase.

**Owner context:** the owner is a sports business owner, not a professional developer. Explain things in plain language, and give exact step-by-step instructions for anything done in the Firebase console or terminal. Never assume prior DevOps knowledge.

## 1. What this is, and where it stands

An internal management portal for **Palace Sports** (football pitch rental, prices in **AED**, timezone **Asia/Dubai**). The owner and staff book pitches and track revenue. There is no customer-facing booking.

The owner's decision (2026-10-11): **keep using the existing booking documents in Firestore, exactly where they are, and build the new system on top of them.** There is no copy and no migration to a new shape. New bookings are simply added to the same collection, in the same format. The owner does not mind the old site going offline once the new one replaces it.

| | Legacy app (live until cutover) | New React app (being built) |
|---|---|---|
| Where | https://ayebaretony.github.io/epbooking/ (`index.html` + `firebase-config.js` on `main`, archived in `legacy/` on the rebuild branch) | `~/Desktop/epbooking-react`, branch `react-rebuild` of this repo |
| Stack | One HTML file, Firebase compat SDK from CDNs | React + TypeScript + Vite (see §4) |
| Data | Firestore collection `bookings` | **The same `bookings` collection, same documents.** Plus a few new supporting collections (§5) |
| Auth | Fake (hard-coded in the page) | Real Firebase Authentication |

- **Firebase project:** `pitchbookingsystem-6e222` (Cloud Firestore). Same project, same data.
- **Reference project:** the owner's other app, **Servly** (`/Users/tony/Desktop/servly/servlycode`, a tennis court booking system), is an **example only** for stack, folder structure, conventions, Firestore rules style and the double-booking guard. Read it freely, but **never edit, commit to, push or open PRs on it**, and never touch its `.env.local` or Firebase project (`servly-87915`). Its data model differs from ours, so don't copy its schema.
- **Repo:** `ayebaretony/epbooking` (**public**). Never commit secrets, backups or data exports.

## 2. Prime directive: protect the production data

The `bookings` collection holds a year of real bookings and revenue history. **Losing, corrupting or silently reshaping any of it is the worst possible outcome.** The whole point of this project is to keep this data and build on it.

1. **Existing `bookings` documents are never deleted, bulk-updated, reshaped or "migrated".** No field is renamed, removed or converted. `date` stays a `YYYY-MM-DD` string, times stay `HH:mm` strings, money stays AED numbers, exactly as they are today.
2. The app may write to an existing document **only when a signed-in user explicitly edits or cancels that one booking** in the UI. Never in a loop, never as a clean-up, never from a script.
3. Changes to the data model are **additive only**: new optional fields on bookings (§5) and new collections. Any code that reads bookings must still work on documents that lack the new fields (treat missing as the default).
4. Before anything that could affect data, take a fresh backup: `python3 scripts/backup_bookings.py`. It is read-only, pages through the whole collection, cross-checks the count and writes JSON into `backups/` (git-ignored, because it holds client personal data). The latest verified backup is `backups/bookings-20261010-202009.json` (482 documents).
5. Every script that writes to Firestore must be **idempotent** (safe to run twice), have a **`--dry-run`** mode, **write only to the new collections** (never `bookings`), and verify its result afterwards. Show the owner the dry-run output before the real run, and get an explicit yes.
6. Develop and test against the **Firebase Emulator Suite**, never against `pitchbookingsystem-6e222`. Load the backup into the emulator's `bookings` collection to test with realistic data.
7. Deploy only when asked. Work on branches, not on `main`.

## 3. The existing data (what is there today)

Collection **`bookings`**, one document per booking, auto-generated IDs:

| Field | Type | Notes |
|---|---|---|
| `pitch` | string | Exactly one of `Fifa Pitch`, `Airdome`, `Junior Football Pitch`, `Half Pitch` |
| `clientName` | string | Free text |
| `contact` | string | Phone number (8 are empty) |
| `date` | string | `YYYY-MM-DD` (a string, not a Timestamp) |
| `startTime` / `endTime` | string | `HH:mm` (24h) |
| `pricePerHour` | number | AED, can have decimals (e.g. 527.1) |
| `hours` | number | Stored at write time |
| `totalPayment` | number | Stored at write time, AED |

**Verified against the backup of 2026-10-10 (482 documents):**
- Every document has exactly these nine fields, with consistent types. `totalPayment == hours * pricePerHour` for all of them.
- Dates run from **2025-04-02 to 2027-01-29**. **46 bookings are dated 2026-10-11 or later** (recurring series).
- Pitch counts: Fifa Pitch 308, Airdome 107, Junior Football Pitch 44, Half Pitch 23.
- Opening hours in practice: **07:00 to 23:00**. Every start and end time is on a **30-minute grid**. Nothing runs past midnight.
- **No two bookings overlap on the same pitch.** There are **55 overlaps across different pitches** (Fifa Pitch with Airdome 33, with Junior 13, with Half Pitch 9). The business evidently allows them, so the double-booking rule is **per pitch** (§6).
- Money is lossless in fils: prices have at most 2 decimals and all totals are whole fils. The new price rule (§5) reproduces **all 482 existing totals exactly**, and `hours` always equals minutes divided by 60.
- Covering every booking takes **1,776** 30-minute slots (202 of them from 2026-10-11 on).
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
- **The project lives on the owner's internal disk** at `~/Desktop/epbooking-react` (agreed 2026-10-10), because installs on the external exFAT drive are slow and macOS leaves `._*` files. The external drive (`/Volumes/Tony/footballbooking`) is a second clone used for backups and the legacy files. Work in the internal-disk clone.
- It is a git clone of this repo on a `react-rebuild` branch. `main` keeps serving the legacy site until cutover (§7).
- The legacy `index.html` and `firebase-config.js` were moved to `legacy/` on this branch so Vite can have its own root `index.html`. The live site is unaffected because it is served from `main`. The hard-coded login in `legacy/index.html` was redacted on this branch.
- **Phase 0 status (2026-10-10):** scaffold, config, emulator wiring, typed models and the pure logic helpers (`src/lib/money.ts`, `conflicts.ts`, `time.ts`) are in place, with `npm test`, `npm run build` and `npm run lint` passing. Colour tokens and UI primitives are **waiting for the owner's designs**.
- **There is deliberately no `.firebaserc` and no deploy script**, and `firestore.rules` is a deny-all placeholder. Deploying it to `pitchbookingsystem-6e222` would lock the live legacy app out. Add them only at cutover (§7), with the owner's go-ahead.
- Unit tests use Node's built-in runner (`npm test`, no extra dependency). Keep the logic in `src/lib` pure so it stays testable this way.
- The Firestore emulator needs **Java 17+**. It was not installed on the owner's Mac at the time of writing.

### Hard constraints
1. **Budget is zero.** Stay within the Firebase **Spark (free) plan**.
2. **No Cloud Functions** (they need the paid plan). Do logic in the client with Firestore transactions and security rules.
3. **No other paid or third-party backend services.** Ask first.
4. **No new dependencies without asking.** State what, why and its size, then wait. The Servly stack above is pre-approved.
5. **Never commit secrets.** The Firebase web config goes in `.env.local` (git-ignored), with `.env.example` committed. The web API key is not a secret, but keep config out of source anyway.
6. **Don't invent features.** Suggest them at the end of a task instead.
7. **Match the owner's approved designs.** The UI is being designed by the owner (Flowstep and screenshots). Do not redesign. Until designs exist, build only unstyled or primitive components and the data and logic layers.

### Folder structure (same layout as Servly)
```
/src
  /app            router, providers, layout shell
  /components/ui  Button, Card, Badge, Input, Select, Modal, Table, StatCard, Skeleton, Toast
  /features       auth, dashboard, calendar, bookings, pitches, revenue, settings
  /lib            firebase.ts, money.ts, time.ts, conflicts.ts
  /types
firestore.rules  firestore.indexes.json  firebase.json  .env.example
/scripts          backup and the slot backfill, never run against production without approval
```
Feature folders own their hooks, components and Firestore queries. Components never call Firestore directly. They use hooks or a `*.service.ts` file.

### Working rules
- **Work in phases** (§8). Finish and verify one before the next. **Before coding a phase, post a short plan** (files to change, data touched). **After, summarise** what was built and how to test it.
- One screen or feature per task. Don't touch unrelated files.
- TypeScript strict, no `any` without a comment saying why.
- Every data screen has **loading (skeleton), empty (friendly message plus action) and error (message plus retry)** states.
- Forms: validate before submit, inline errors, disable submit while saving, success toast. **Confirm destructive actions** with a modal.
- Run `npm run build`, `npm run lint` and `npm test` before declaring a task done.
- When something is ambiguous, ask one clear question rather than guessing.
- Keep code boring and readable: small functions, clear names, short comments explaining *why*.
- Don't put real client names, phone numbers or emails in code, tests, screenshots, commits or chat. Use fake data (`Test Client`, `+971500000000`). Don't log customer details to the console.

## 5. Data model: existing bookings plus additive extras

### `bookings` (existing collection, existing documents untouched)
The nine fields in §3 stay exactly as they are, and **new bookings written by the app use the same nine fields in the same formats** (`date` string, `HH:mm` strings, AED numbers). That keeps every document uniform, so it can always be read the same way.

**Optional additive fields.** The app may add these to bookings it creates, or to an existing booking when a user edits or cancels it. Old documents simply don't have them:

| Field | Type | Meaning when missing |
|---|---|---|
| `status` | `"confirmed"` \| `"pending"` \| `"cancelled"` | `"confirmed"` |
| `notes` | string | none |
| `createdBy` | string (uid) | unknown (created before sign-in existed) |
| `createdAt` / `updatedAt` | Timestamp | unknown |
| `seriesId` | string | not part of a recurring series |

Because old documents lack `status`, **filter by status in the app**, never with a Firestore `where("status", ...)`, which would silently skip every old booking. Revenue counts `confirmed` (or missing status) only. Add further optional fields only with the owner's agreement, and update this table and the rules in the same change.

### Money, time and pitch rules
- Stored money stays an AED number (e.g. `527.1`). **Inside the code, calculate in integer fils** (`aedToFils`, `calcTotalMinor`, `filsToAed` in `lib/money.ts`) and convert back only when writing. For a new booking: `durationMinutes` from the times, `hours = durationMinutes / 60`, `totalPayment = filsToAed(round(rateFils * durationMinutes / 60))`. This reproduces every existing total. Never recompute the total of an existing booking.
- Show money only through the shared formatter (`Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })`). Components never write "AED" themselves.
- `date` and times are the business's local time (Asia/Dubai). "Today" and "now" are computed in that timezone. Date maths happens on `YYYY-MM-DD` strings in UTC (`lib/time.ts`). Never use `toISOString()` to produce a booking date.
- Range queries use the `date` string: `where("date", ">=", from).where("date", "<=", to).orderBy("date")`. This needs no extra index. Sort by `startTime` in the app. **Always use bounded ranges.** Never load the whole collection in the UI.
- The pitch **name** is the stored identity (`pitch` field). `pitchSlug(name)` (e.g. `fifa-pitch`) is derived from it for slot keys and `pitches` document ids. **Pitch names must never be renamed or deleted** (archive instead), because old bookings refer to them by name.
- Pitches have no fixed price. A pitch's **default hourly rate** (editable in Settings, shown in the designs) only **prefills** the booking form. Every booking stores its own `pricePerHour`, as today, because real prices vary (§3).

### New supporting collections (new documents only, nothing existing is touched)
```
users/{uid}              displayName, email, role "admin"|"staff", active (bool), createdAt
pitches/{pitchSlug}      name (exactly as in bookings), description (e.g. "11-a-side"), defaultRatePerHour (AED), status "available"|"maintenance", color, sortOrder, archived
slots/{pitchSlug}_{date}_{HHmm}   one doc per occupied 30-minute slot: pitch, date, bookingId|null, blockId|null
blocks/{blockId}         pitch, date, startTime, endTime, reason, createdBy   (maintenance closures)
settings/center          centerName, currency "AED", timezone "Asia/Dubai", openTime "07:00", closeTime "23:00", slotMinutes 30
settings/security        idleTimeoutMinutes
```
`closeTime` is `23:00` because real bookings run that late.

### Slot backfill (one-time, additive)
The double-booking guard (§6) needs a slot document for every booking. Existing bookings have none, so a **backfill script** creates them:
- Reads `bookings`, writes **only to `slots`** (and seeds `pitches` and `settings/center`). It never writes to `bookings`.
- Idempotent (slot ids are deterministic), has `--dry-run`, **reports** any slot collision instead of failing, and verifies afterwards: slot count equals the sum of `hours * 2` over all bookings (**1,776** for the 2026-10-10 backup) and every slot's `bookingId` exists.
- Run it in the emulator first with the backup loaded. Production run only with the owner's explicit approval, as part of the cutover (§7).
- The app deletes or rewrites a booking's slot documents in the same transaction when that booking is edited, cancelled or deleted. Deleting a slot that doesn't exist is fine.

## 6. Double-booking guard (critical)

Same design as Servly, applied **per pitch**:

1. Compute every slot key the booking covers: `${pitchSlug}_${date}_${HHmm}` at 30-minute granularity.
2. In one `runTransaction`, read all of those slot docs. **If any exists, abort** with "That time is no longer available". Otherwise write the booking and all its slot docs together.
3. Cancelling, editing or deleting updates the slot docs in the same transaction. Maintenance blocks write slot docs too.
4. Security rules also reject creating a slot doc that already exists (no `update` on slots).
5. Different pitches may overlap in time, because the current data shows the business allows it (§3). Whether `Half Pitch` physically shares space with `Fifa Pitch` is an **open decision** (§9).
6. Recurring bookings are **in scope** (the legacy app has them and 46 current bookings came from them): create N bookings, each through the transaction, sharing an optional `seriesId`. Show the owner which dates conflict instead of silently skipping them. Monthly series count from the original date (`addMonths`), so they never drift.
7. Test: overlapping times, back-to-back (allowed), same time on different pitches (allowed), cancel then rebook (allowed), two simultaneous attempts (one must fail).

## 7. Auth, security and cutover

- Firebase Auth: email/password (Google sign-in optional, as in Servly). **Signing up does not grant access.** Only users with a `users/{uid}` doc with `active: true` and a valid role get in. Roles: **admin** (everything, including deleting bookings) and **staff** (create, edit and cancel bookings, view dashboards). The **first admin** is created by hand in the Firebase console (give the owner step-by-step instructions).
- Write `firestore.rules` for real: deny by default, role checks per collection, field validation, slots create-only, nobody can change their own role. **Never `allow read, write: if true`.** The `bookings` rules must **accept every existing document as it is** (nine required fields, plus the optional additive fields of §5, with type checks) so old and new bookings can both be read and edited. Test the rules in the emulator against the backup data, including attempts that must fail.

**Current exposure:** the live rules are `allow read, write;` with no condition (confirmed 2026-10-10). Anyone who knows the project ID (it is in the public repo) can read, change and delete all bookings and client phone numbers. Deploying the new rules closes this. **They also lock out the legacy site, which has no sign-in.** The owner has accepted that the old site goes offline. Do not deploy locked rules before the new app can sign people in and manage bookings, or staff will be locked out of their own data.

**Cutover sequence (each step needs the owner's go-ahead):**
1. New app tested on the emulator with the backup loaded. Owner creates the first admin and staff accounts in the console.
2. Fresh backup (`scripts/backup_bookings.py`).
3. Run the slot backfill against production **while the old rules are still in place** (dry run first, then real run, then verify). It only adds to `slots`, `pitches` and `settings`.
4. Deploy the new `firestore.rules` and the new app to Firebase Hosting together. The legacy site stops working.
5. Replace the legacy GitHub Pages `index.html` with a notice and link to the new app. The old hard-coded password stays in public git history, so treat it as compromised and never reuse it.
6. **Rollback** if needed: redeploy the old open rules. Existing bookings are intact. Only bookings the owner or staff edited in the new app gained the optional extra fields, and the legacy app ignores those.

Don't print, log or copy the old credentials anywhere.

**Getting there fast:** the data stays exposed until step 4, and there is no copy step to wait for. So build **Phase 1 (sign-in and rules) and Phase 3 (bookings)** first and cut over as soon as those work, then add the calendar, dashboard and reports. The owner decides when.

## Designs and what they need from the data

The owner's designs are the PNG screens in `assets/` (reviewed 2026-10-11): `auth`, `home` (Today), `calender`, `Bookings`, `add new booking`, `Booking details`, `dashboard`, `reports`, `settings`. Each shows a mobile and a desktop layout (bottom tab bar on mobile, left sidebar on desktop). **Their sample data (Alex Morgan, Test Client A, 2024 dates, AED 184,250 and so on) is placeholder. Never hard-code or copy it. All numbers come from Firestore.** The `settings` screen also shows a style guide, which is a reference for us, not a feature to build.

**Design tokens** (from the style guide in `settings.png`; define once as Tailwind theme tokens): deep green `#186534` (primary), slate `#334155`, success `#15803D`, warning `#B45309`, danger `#B91C1C`. Type scale: display 28px, heading 20px, body 16px, caption 12px. 8px spacing grid. Pale green page background, white cards with a thin border and rounded corners. Pitch colours in the designs: Fifa Pitch green, Airdome blue, Junior Football Pitch amber, Half Pitch purple (stored in `pitches.color`).

**Where the designs and the real data disagree, or need something we don't store.** Handle these as listed, and ask the owner before inventing anything beyond them:
- **Schedule window:** the designs show 16:00 to 22:00. **96 of the 482 bookings start before 16:00** (mornings from 07:00), so the Today and Calendar views must cover the full opening hours (07:00 to 23:00, from `settings/center`). They can scroll or default to a busy window, but must never hide a booking.
- **Booking number (`#PS-1042`):** bookings have no number, only a random document id. Show a short id derived from the document id (e.g. the first 6 characters) until the owner decides otherwise. Don't add a counter.
- **Booking type (One-off or recurring):** shown from `seriesId`. Older recurring bookings have none, so they show as "One-off".
- **Created by and Created date:** missing on all existing bookings (they predate sign-in). Show "Not recorded" for those, never a guess.
- **Activity timeline and "Recent activity" (payment received, new booking request):** **not in the data.** There are no payments, no activity log and no booking requests. Do **not** build or fake them in the first version. "Recent activity" may list recently created or cancelled bookings (from `createdAt` and `status`) once those exist. Payments are an open decision (§9).
- **Call and WhatsApp buttons:** contacts are phone numbers in mixed formats (about 390 local `05xxxxxxxx`, about 77 `+971...` in different layouts, 8 empty, a few odd ones). Build a **display-only** normaliser (`05xxxxxxxx` becomes `+9715xxxxxxxx`) used just for the `tel:` and `wa.me` links. Hide the buttons when the number can't be normalised. **Never rewrite the stored `contact`.**
- **Repeat clients:** group by the **trimmed, lower-cased** client name (exact strings give 44 clients but only 39 once stray spaces are ignored). Do not change the stored names.
- **Status:** the designs show Confirmed and Cancelled. Cancelling sets `status: "cancelled"` and frees the slots (the design says the booking "remains in your records"). Only an admin can delete permanently, so hide the delete action for staff.
- **Contact field label:** the design says "phone or email". It is still the single `contact` field.
- **Default pitch prices** in Settings (750, 400, 500, 250 in the design) are placeholders. The owner enters the real defaults. The form still lets each booking use its own rate.
- **Preferences:** dark mode and default booking duration are per-user conveniences, so store them on the device (localStorage) or the user's own `users` document, never in `settings/center` (admin-only). Currency is fixed to AED (shown disabled).
- **Staff accounts:** the sign-in design has no sign-up or Google button, and Settings has no user management. For the first version the owner creates each staff member's Auth account in the Firebase console plus a `users/{uid}` document, with step-by-step instructions from us. A "Team" screen is an open decision (§9).
- **Reports:** the PDF and Excel exports need libraries the legacy app used (jsPDF, jspdf-autotable, SheetJS `xlsx`). **They are not in the approved stack. Ask the owner before adding them** (and prefer a maintained SheetJS build over the old npm `xlsx@0.18.5`, which has known vulnerabilities). Do this in Phase 6, not before.

**Screen to phase:** auth and shell go in Phase 1, Settings (pitches and profile) in Phase 2, Bookings, Add booking and Booking details in Phase 3, Today in Phase 3 (it needs only today's bookings) or early Phase 4, Calendar in Phase 4, Dashboard in Phase 5, Reports in Phase 6.

## 8. Build phases

- **Phase 0, Setup (done):** scaffold, emulators, typed models, money, slot and date helpers with tests. Colour tokens and UI primitives wait for the owner's designs.
- **Phase 1, Auth and shell:** login, auth guard, approval-pending screen, sidebar and topbar, `users` handling, the real `firestore.rules` plus rules tests against the backup data.
- **Phase 2, Pitches and settings:** `pitches` list with status and colour, seed `settings/center`. Write the **slot backfill script** and an emulator seed script that loads the backup into `bookings`.
- **Phase 3, Bookings:** new, edit and cancel with the **transactional conflict guard**, recurring bookings, list with filters, search, pagination, CSV and Excel export. **Cutover (§7) can happen after this phase**, with the owner's go-ahead.
- **Phase 4, Calendar:** month, week and day views, pitch colour legend, day panel, click-to-create, maintenance blocks.
- **Phase 5, Dashboard:** stat cards, today's timeline, revenue this month, recent bookings, plus the existing "top repeat clients" and "pitch earnings" views.
- **Phase 6, Revenue and reports:** revenue by day, week, month and pitch, plus the PDF performance report the legacy app produced. (The legacy "AI Analysis" is template text, not real AI. Don't claim otherwise.)
- **Phase 7, Hardening:** rules review and tests, index check, quota check, accessibility pass, empty-data walkthrough, handover notes.

**Query discipline (Spark limits):** always query by a bounded date range, paginate lists with `limit()` and `startAfter()`, use `getCountFromServer()` for totals, use `onSnapshot` only for today's view, cache pitches and settings, and commit composite indexes in `firestore.indexes.json` for any multi-field query.

**Definition of done:** matches the design, has loading, empty and error states, works on a phone-width screen, shows no hard-coded data, formats all money in AED through the shared formatter, `npm run build`, `npm run lint` and `npm test` pass, queries are bounded and indexed, security rules cover every collection and field, and **existing bookings still display and total correctly**.

## 9. Decisions and business rules (confirm with the owner, don't assume)

Defaults are in italics and should sit behind settings so they're easy to change.

- Data approach: **use the existing `bookings` documents directly, no copy, additive changes only** (decided 2026-10-11). The old site may go offline at cutover (decided 2026-10-11).
- Project folder: **internal disk** (decided 2026-10-10). Hosting: *Firebase Hosting*. Deploy branch for the legacy site: `main`.
- Do `Half Pitch` and `Fifa Pitch` (or any other pair) physically share space and need to block each other? *No: conflicts are per pitch only, matching current data.*
- Opening hours: *07:00 to 23:00*. Are bookings past midnight allowed? *No.*
- What counts as revenue? *Confirmed bookings only (a missing status counts as confirmed). Pending shown separately, cancelled excluded.*
- Payments and deposits tracking (the designs hint at "Payment received"), an activity log, booking requests, a separate clients collection, customer email: *not in the first version* (customer details stay on each booking, as today). Owner to say if payments should come next.
- Booking numbers like `#PS-1042`: *short document id for now.*
- A "Team" screen to add and approve staff: *no, the owner creates accounts in the Firebase console for now.*
- Reports libraries (jsPDF, jspdf-autotable, SheetJS): _needs the owner's approval before Phase 6._
- When to cut over: *after Phase 3.*
- Staff accounts needed (how many, any beyond the owner): _unknown_.
- Cancellation, deposit and peak-pricing policy: _unknown_.

## 10. Quick reference

- Backup: `python3 scripts/backup_bookings.py` (read-only, output in git-ignored `backups/`).
- Firestore console: https://console.firebase.google.com/project/pitchbookingsystem-6e222
- Legacy site (until cutover): https://ayebaretony.github.io/epbooking/
- The external drive creates macOS `._*` files, which are git-excluded locally. If git reports `non-monotonic index` errors, delete any `._*` files under `.git/`.
- When you finish a task, update this file if you changed the architecture, data model or a decision.
