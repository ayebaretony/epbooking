# AGENTS.md — Palace Sports Pitch Booking System (React rebuild)

Instructions for AI code agents working on this project. Read this fully before changing anything, and re-read the relevant section before each phase.

**Owner context:** the owner is a sports business owner, not a professional developer. Explain things in plain language, and give exact step-by-step instructions for anything done in the Firebase console or terminal. Never assume prior DevOps knowledge.

## 1. What this is, and where it stands

An internal management portal for **Palace Sports** (football pitch rental, prices in **AED**, timezone **Asia/Dubai**). The owner and staff book pitches and track revenue. There is no customer-facing booking.

The owner's decision (2026-10-11): **keep using the existing booking documents in Firestore, exactly where they are, and build the new system on top of them.** There is no copy and no migration to a new shape. New bookings are simply added to the same collection, in the same format. The owner does not mind the old site going offline once the new one replaces it.

| | Old app (retired 2026-10-11) | New React app (**LIVE** since 2026-10-11) |
|---|---|---|
| Where | Its address https://ayebaretony.github.io/epbooking/ now shows a notice (`docs/index.html`) that redirects to the new site. The old code is archived in `legacy/` | **https://pitchbookingsystem-6e222.web.app**. Source: this repo's `main` branch, working copy at `~/Desktop/epbooking-react` |
| Stack | One HTML file, Firebase compat SDK from CDNs | React + TypeScript + Vite (see §4) |
| Data | Firestore collection `bookings` | **The same `bookings` collection, same documents.** Plus a few new supporting collections (§5) |
| Auth | Fake (hard-coded in the page) | Real Firebase Authentication |

- **Firebase project:** `pitchbookingsystem-6e222` (Cloud Firestore). Same project, same data.
- **Reference project:** the owner's other app, **Servly** (`/Users/tony/Desktop/servly/servlycode`, a tennis court booking system), is an **example only** for stack, folder structure, conventions, Firestore rules style and the double-booking guard. Read it freely, but **never edit, commit to, push or open PRs on it**, and never touch its `.env.local` or Firebase project (`servly-87915`). Its data model differs from ours, so don't copy its schema.
- **Repo:** `ayebaretony/epbooking` (**public**). Never commit secrets, backups or data exports.
- **GitHub Pages serves `docs/` on `main`, and nothing else.** `docs/index.html` is a notice for the old web address (`ayebaretony.github.io/epbooking`) that sends visitors to the new site. **Everything in `docs/` is published on the internet, so never put anything else there** (that is why the emergency rollback rules live in `rollback/`, not `docs/`). The repo root `index.html` is the React app's own entry file; Pages does not use it. `legacy/` is a read-only archive of the old single-file app (its hard-coded login was removed).

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
- It is a git clone of this repo. **Work on a short-lived branch from `main` and open a pull request** (the `react-rebuild` branch was merged into `main` on 2026-10-11 and is no longer needed). `main` holds the real project. GitHub Pages serves only `docs/` (see §1).
- The old `index.html` and `firebase-config.js` are archived in `legacy/` so Vite can have its own root `index.html`. The hard-coded login in `legacy/index.html` was redacted.
- **Phase 0 status (2026-10-10):** scaffold, config, emulator wiring, typed models and the pure logic helpers (`src/lib/money.ts`, `conflicts.ts`, `time.ts`) are in place, with `npm test`, `npm run build` and `npm run lint` passing. Colour tokens and UI primitives are **waiting for the owner's designs**.
- **There is deliberately no `.firebaserc`:** every deploy command names the project explicitly (`npm run deploy:hosting`, `npm run deploy:rules`). `firestore.rules` is the real rules file and is **live** since the cutover (§7), so changing it changes who can read the owner's bookings.
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
| `createdByName` | string | "Not recorded" (the creator's name at the time, so any staff member can see who made it) |
| `createdAt` / `updatedAt` | Timestamp | unknown |
| `seriesId` | string | not part of a recurring series |

Because old documents lack `status`, **filter by status in the app**, never with a Firestore `where("status", ...)`, which would silently skip every old booking. Revenue counts `confirmed` (or missing status) only. Add further optional fields only with the owner's agreement, and update this table and the rules in the same change.

### Money, time and pitch rules
- Stored money stays an AED number (e.g. `527.1`). **Inside the code, calculate in integer fils** (`aedToFils`, `calcTotalMinor`, `filsToAed` in `lib/money.ts`) and convert back only when writing. For a new booking: `durationMinutes` from the times, `hours = durationMinutes / 60`, `totalPayment = filsToAed(round(rateFils * durationMinutes / 60))`. This reproduces every existing total. Never recompute the total of an existing booking.
- Show money only through the shared formatter (`Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" })`). Components never write "AED" themselves.
- `date` and times are the business's local time (Asia/Dubai). "Today" and "now" are computed in that timezone. Date maths happens on `YYYY-MM-DD` strings in UTC (`lib/time.ts`). Never use `toISOString()` to produce a booking date.
- Range queries use the `date` string: `where("date", ">=", from).where("date", "<=", to).orderBy("date")`. This needs no extra index. Sort by `startTime` in the app. **Always use bounded ranges.** Never load the whole collection in the UI.
- The pitch **name** is the stored identity (`pitch` field). `pitchSlug(name)` (e.g. `fifa-pitch`) is derived from it for slot keys and `pitches` document ids. **Pitch names must never be renamed or deleted** (archive instead), because old bookings refer to them by name.
- **Pitches have no fixed price (owner's decision, 2026-10-11): each client's rate is negotiated.** Every booking stores its own `pricePerHour`, as today. A pitch may optionally have a default hourly rate (Settings), which only **prefills** the booking form. It is **not seeded** and shows as "Not set". The booking form's price box must be typed by the person unless a default exists, and never guessed from history.

### New supporting collections (new documents only, nothing existing is touched)
```
users/{uid}              displayName, email, role "admin"|"staff", active (bool), createdAt
pitches/{pitchSlug}      name (exactly as in bookings), description (e.g. "11-a-side"), defaultRatePerHour (AED, OPTIONAL: absent = "Not set"), color, sortOrder, archived
slots/{pitchSlug}_{date}_{HHmm}   one doc per occupied 30-minute slot: pitch, date, bookingId
```
**Kept deliberately small (2026-10-11):** none of the owner's designs show maintenance blocks, pitch status, opening-hours settings or an idle-timeout setting, so there are **no `blocks` or `settings` collections** in the first version. Opening hours (**07:00 to 23:00**, because real bookings run that late), 30-minute slots, currency **AED** and timezone **Asia/Dubai** are code constants (`DEFAULT_CENTER_SETTINGS` in `src/types/models.ts`). Add a collection only when a design needs it, with the owner's agreement.

### Slot backfill (one-time, additive)
The double-booking guard (§6) needs a slot document for every booking. Existing bookings have none, so a **backfill script** creates them:
- Reads `bookings`, writes **only to `slots`** (and seeds `pitches`). It never writes to `bookings`.
- Idempotent (slot ids are deterministic), has `--dry-run`, **reports** any slot collision instead of failing, and verifies afterwards: slot count equals the sum of `hours * 2` over all bookings (**1,776** for the 2026-10-10 backup) and every slot's `bookingId` exists.
- Run it in the emulator first with the backup loaded. Production run only with the owner's explicit approval, as part of the cutover (§7).
- The app deletes or rewrites a booking's slot documents in the same transaction when that booking is edited, cancelled or deleted. Deleting a slot that doesn't exist is fine.

## 6. Double-booking guard (critical)

Same design as Servly, applied **per pitch**:

1. Compute every slot key the booking covers: `${pitchSlug}_${date}_${HHmm}` at 30-minute granularity.
2. In one `runTransaction`, read all of those slot docs. **If any exists, abort** with "That time is no longer available". Otherwise write the booking and all its slot docs together.
3. Cancelling, editing or deleting updates the slot docs in the same transaction. 4. Security rules also reject creating a slot doc that already exists (no `update` on slots).
5. Different pitches may overlap in time, because the current data shows the business allows it (§3). Whether `Half Pitch` physically shares space with `Fifa Pitch` is an **open decision** (§9).
6. Recurring bookings are **in scope** (the legacy app has them and 46 current bookings came from them): create N bookings, each through the transaction, sharing an optional `seriesId`. Show the owner which dates conflict instead of silently skipping them. Monthly series count from the original date (`addMonths`), so they never drift.
7. Test: overlapping times, back-to-back (allowed), same time on different pitches (allowed), cancel then rebook (allowed), two simultaneous attempts (one must fail).

## 7. Auth, security and cutover

- Firebase Auth: email/password (Google sign-in optional, as in Servly). **Signing up does not grant access.** Only users with a `users/{uid}` doc with `active: true` and a valid role get in. Roles: **admin** (everything, including deleting bookings) and **staff** (create, edit and cancel bookings, view dashboards). The **first admin** is created by hand in the Firebase console (give the owner step-by-step instructions).
- Write `firestore.rules` for real: deny by default, role checks per collection, field validation, slots create-only, nobody can change their own role. **Never `allow read, write: if true`.** The `bookings` rules must **accept every existing document as it is** (nine required fields, plus the optional additive fields of §5, with type checks) so old and new bookings can both be read and edited. Test the rules in the emulator against the backup data, including attempts that must fail.

**Cutover status: DONE on 2026-10-11.** Before it, the live rules were `allow read, write;` with no condition, so anyone who knew the project ID could read, change and delete every booking and client phone number. The new rules are now deployed: an anonymous visitor gets `PERMISSION_DENIED` on bookings, slots, pitches and users (verified from outside, including a write attempt). The legacy site (served from `main` by GitHub Pages) can no longer read anything because it has no sign-in, which the owner accepted. The owner is the only user for now (one admin `users` record); staff accounts are created in the Firebase console plus a `users/{uid}` record when needed.

**Cutover sequence (carried out 2026-10-11, each step with the owner's go-ahead; kept as the record and the pattern for any future rules change):**
1. New app tested on the emulator with the backup loaded. Owner creates the first admin and staff accounts in the console.
2. Fresh backup (`scripts/backup_bookings.py`).
3. Run the slot backfill against production **while the old rules are still in place** (dry run first, then real run, then verify). It only adds to `slots` and `pitches`.
4. Deploy the new `firestore.rules` and the new app to Firebase Hosting together. The legacy site stops working.
5. Replace the legacy GitHub Pages `index.html` with a notice and link to the new app (**still to do**: `main` still serves the old page). The old hard-coded password stays in public git history, so treat it as compromised and never reuse it.
6. **Rollback** if needed: redeploy the old open rules. Existing bookings are intact. Only bookings the owner or staff edited in the new app gained the optional extra fields, and the legacy app ignores those.

Don't print, log or copy the old credentials anywhere.

**Done in practice:** the order used was backup, slot backfill on production (1,776 slots and 4 pitches, add-only, bookings verified identical before and after), publish the site, run every query the app makes against the live project to check no extra indexes were needed (none were), final backup, deploy the rules, then verify the lock from outside. The slot backfill is **already done**: do not run it again unless bookings were created outside the app.

## Designs and what they need from the data

The owner's designs are the PNG screens in `assets/` (reviewed 2026-10-11): `auth`, `home` (Today), `calender`, `Bookings`, `add new booking`, `Booking details`, `dashboard`, `reports`, `settings`. Each shows a mobile and a desktop layout (bottom tab bar on mobile, left sidebar on desktop). **Their sample data (Alex Morgan, Test Client A, 2024 dates, AED 184,250 and so on) is placeholder. Never hard-code or copy it. All numbers come from Firestore.** The `settings` screen also shows a style guide, which is a reference for us, not a feature to build.

**Design tokens** (measured from the pixels in the designs and defined in `src/index.css`): primary green `#245521`, page `#F8FCF7`, sidebar `#EFF6EF`, active nav `#DBE6DA`, error tint `#F8EBEA`; plus slate `#334155`, success `#15803D`, warning `#B45309`, danger `#B91C1C` from the style guide labels. Type scale: display 28px, heading 20px, body 16px, caption 12px. 8px spacing grid. Pale green page background, white cards with a thin border and rounded corners. Pitch colours in the designs: Fifa Pitch green, Airdome blue, Junior Football Pitch amber, Half Pitch purple (stored in `pitches.color`).

**Where the designs and the real data disagree, or need something we don't store.** Handle these as listed, and ask the owner before inventing anything beyond them:
- **Schedule window:** the designs show 16:00 to 22:00. **96 of the 482 bookings start before 16:00** (mornings from 07:00), so the Today and Calendar views must cover the full opening hours (07:00 to 23:00, from the code constants). They can scroll or default to a busy window, but must never hide a booking.
- **Booking number (`#PS-1042`):** bookings have no number, only a random document id. Show a short id derived from the document id (e.g. the first 6 characters) until the owner decides otherwise. Don't add a counter.
- **Booking type (One-off or recurring):** shown from `seriesId`. Older recurring bookings have none, so they show as "One-off".
- **Created by and Created date:** missing on all existing bookings (they predate sign-in). Show "Not recorded" for those, never a guess.
- **Activity timeline and "Recent activity" (payment received, new booking request):** **not in the data.** There are no payments, no activity log and no booking requests. Do **not** build or fake them in the first version. "Recent activity" may list recently created or cancelled bookings (from `createdAt` and `status`) once those exist. Payments are an open decision (§9).
- **Call and WhatsApp buttons:** contacts are phone numbers in mixed formats (about 390 local `05xxxxxxxx`, about 77 `+971...` in different layouts, 8 empty, a few odd ones). Build a **display-only** normaliser (`05xxxxxxxx` becomes `+9715xxxxxxxx`) used just for the `tel:` and `wa.me` links. Hide the buttons when the number can't be normalised. **Never rewrite the stored `contact`.**
- **Repeat clients:** group by the **trimmed, lower-cased** client name (exact strings give 44 clients but only 39 once stray spaces are ignored). Do not change the stored names.
- **Status:** the designs show Confirmed and Cancelled. Cancelling sets `status: "cancelled"` and frees the slots (the design says the booking "remains in your records"). Only an admin can delete permanently, so hide the delete action for staff.
- **Contact field label:** the design says "phone or email". It is still the single `contact` field.
- **Default pitch prices** in Settings (750, 400, 500, 250 in the design) are placeholders, not data. Real prices are negotiated per client, so pitches are seeded with **no price** ("Not set") and a default is optional. Don't derive a default from past bookings either.
- **Preferences:** dark mode and default booking duration are per-user conveniences, so store them on the device (localStorage) or the user's own `users` document, never in a shared document. Currency is fixed to AED (shown disabled).
- **Staff accounts:** the sign-in design has no sign-up or Google button, and Settings has no user management. For the first version the owner creates each staff member's Auth account in the Firebase console plus a `users/{uid}` document, with step-by-step instructions from us. A "Team" screen is an open decision (§9).
- **Reports:** built without new packages, using the repo's own small PDF and `.xlsx` writers (see Phase 6 status). Do not add jsPDF or the old npm `xlsx@0.18.5` (known vulnerabilities).

**Screen to phase:** auth and shell go in Phase 1, Settings (pitches and profile) in Phase 2, Bookings, Add booking and Booking details in Phase 3, Today in Phase 3 (it needs only today's bookings) or early Phase 4, Calendar in Phase 4, Dashboard in Phase 5, Reports in Phase 6.

## 8. Build phases

- **Phase 0, Setup (done):** scaffold, emulators, typed models, money, slot and date helpers with tests. Colour tokens and UI primitives wait for the owner's designs.
- **Phase 1, Auth and shell:** login, auth guard, approval-pending screen, sidebar and topbar, `users` handling, the real `firestore.rules` plus rules tests against the backup data.
  - **1A done (2026-10-11):** `firestore.rules` and `rules-tests/rules.test.ts` (`npm run test:rules`, 25 tests, emulator only). Run it with `BACKUP_FILE=<simplified backup .json>` and it also proves **every one of the 482 real bookings is accepted** (readable, editable, cancellable). Weakening a rule was confirmed to make the matching tests fail. **Whenever you change `firestore.rules`, re-run it with the backup.** The rules are still **not deployed** and must not be until cutover (§7).
  - **1B done (2026-10-11):** sign-in screen (desktop split layout and phone layout), show/hide password, friendly errors, forgot-password, route guards, "waiting for approval" screen, app shell (sidebar on desktop, top bar and bottom tabs on phones), placeholder pages and a Sign out button in Settings. Checked in a browser against the emulator for approved, unapproved and signed-out people. `npm run build`, `lint` and `test` pass. Try it locally with `scripts/seed_emulator_user.mjs` (README).
  - **Colours measured from the designs:** primary `#245521`, page `#F8FCF7`, sidebar `#EFF6EF`, active nav `#DBE6DA`, error tint `#F8EBEA`, font Inter. These are in `src/index.css`. (The tiny hex labels in the style guide image did not match the pixels, so the measured values win.)
  - **Phase 2 done (2026-10-11):**
    - `src/lib/backfill.ts` (+ tests) plans the slot documents and seeds the pitches from the names on bookings. On the 2026-10-11 backup: **482 bookings, 1,776 slots, 0 clashes, 0 skipped**; pitches Fifa Pitch, Airdome, Junior Football Pitch, Half Pitch with **no price**.
    - `scripts/seed_emulator.ts --backup <file> [--reset]` loads the backup into the emulator, creates the pitches and slots, and makes the fake test users (**emulator only**). Running it twice changes nothing.
    - `scripts/backfill_slots.ts` is the one-time additive setup for production. It reads `bookings`, writes only `slots` and `pitches` (create-only, never overwrites), is a **dry run by default**, and refuses `--production --apply` without `--confirm-production`. **Do not run it against production without the owner's explicit go-ahead, and only before the new rules are deployed (§7 step 3).**
    - Settings screen: profile (edit your name), pitch management (admins add and edit; staff see a read-only list; the name of a saved pitch can't change), preferences (currency AED fixed, default booking duration kept on the device), and Sign out. Loading, empty and error states. **Dark mode is not built** (the designs have no dark palette; ask the owner before inventing one).
    - Rules: `defaultRatePerHour` became optional on pitches (26 rules tests).
  - **Phase 3 done (2026-10-11):**
    - **Bookings list:** search, pitch, month and year filters, newest/oldest sort, pagination (10 per page), table on desktop and cards on phones, view/edit/delete actions (delete admin-only). One year is loaded at a time (a bounded query); the year list comes from the first and last booking dates.
    - **New / edit booking** (side panel on desktop, full screen on phones, openable from any screen via `useBookingDrawer().openNew(prefill)`): live total, a live "Slot available / already booked" check that does not wait for a price, the pitch's optional default price fills an EMPTY price box only, end time fills from the device's default duration, weekly and monthly series with a date preview that marks clashing dates. **The price box is never pre-filled from history.**
    - **Booking details page:** summary, client contact with Call and WhatsApp (display-only phone normaliser), type (One-off or Recurring), created by and when ("Not recorded" for old bookings), Edit, Cancel booking (with the design's confirmation), and Delete permanently (admin only).
    - **`bookings.service.ts`** (database passed in, so it is tested in the emulator): create, edit, cancel and delete each run as ONE transaction over the booking and its slots. A clash throws `SlotConflictError` and writes nothing. Editing leaves `hours` and `totalPayment` exactly as stored unless the times or price changed, and never adds `createdBy` to an old booking. A recurring series is created one booking per transaction and reports every date that could not be booked.
    - **Rules:** new optional `createdByName` (set once, like `createdBy`).
    - **Tests:** 70 unit tests, and 41 emulator tests including five people booking the same slot at once (exactly one wins) and a run against all 482 real bookings. Removing the clash check from the service was confirmed to break four tests.
    - **Not built yet:** Today and Calendar (Phase 4), Dashboard (5), Reports (6). The booking activity timeline and "pending" workflow are not built (no data behind them).
  - **Phase 4 done (2026-10-11):**
    - **Today:** date, New booking, four stat cards (bookings today, hours booked, revenue today, available slots), the schedule, and an Up next card with a countdown. The schedule is a **live feed** (`subscribeToDay`): a booking made on another phone appears without reloading. On desktop it is a timeline (a row per pitch, free gaps clickable to book, a red now-line, scrolled to the busy part of the day); on phones it is a card per pitch with bookings and "Free · tap to book".
    - **The schedule always covers the full opening hours (07:00 to 23:00)**, never the design's 16:00 to 22:00, because 96 real bookings start before 16:00.
    - **Numbers:** cancelled bookings are left out; revenue counts confirmed bookings (no status = confirmed); "Available slots" is the count of free 30-minute slots from now until closing, across active pitches.
    - **Calendar:** Day, Week and Month views (Monday-first weeks), Previous / Next / Today, pitch filter chips, and click-an-empty-slot-to-book with the pitch, date and time pre-filled. Week is a pitch-by-day grid on desktop and a day-by-day agenda on phones; Month shows booking chips (dots on phones) and opens a day when clicked. Each view loads only the dates on screen.
    - **Not built:** "Recent activity" on Today (the design's payments and booking requests have no data behind them). Left out on purpose; revisit if payments are added.
    - **Tests:** 82 unit tests, 43 emulator tests (adds the date-range query and the live feed, which is checked to deliver the first state, every create and cancel, and nothing after unsubscribing). Browser-checked on desktop and phone against the emulator.
    - `scripts/seed_emulator.ts --demo-today` adds a few FAKE bookings dated today (never overlapping real ones) so Today has something to show.
  - **Phase 5 done (2026-10-11):**
    - **Dashboard:** a year selector, four cards (Total revenue, This month with the change on last month, Bookings, Average booking), Revenue by month (bar chart with a text table for screen readers), Revenue by pitch for a chosen month, Top repeat clients, and Pitch utilisation (a weekday-by-hour heatmap over only the hours that have bookings, so the morning hours show). It loads one year plus the December before it (a bounded read) and reloads when a booking is saved.
    - **Definitions (`src/lib/dashboard.ts`, pure and tested):** cancelled bookings count for nothing. Revenue counts confirmed bookings (no status = confirmed). The Bookings card counts confirmed and pending. Average booking = revenue per confirmed booking (free bookings with a price of 0 are included, so they lower it). Repeat clients are matched ignoring extra spaces and capital letters, need 2+ bookings in the year, and show the spelling used most often. For years other than the current one, the "This month" card becomes "Best month".
    - **Verified:** the calculations were checked against an independent Python calculation on the real backup for 2025 and 2026 (monthly revenue, totals, bookings, average, top clients, heatmap totals): all matched.
    - **Performance:** each screen is now loaded when first opened (`React.lazy`). The charts library only loads on the Dashboard (main bundle about 82 KB gzipped, Dashboard about 107 KB).
    - **Tests:** 92 unit tests; Dashboard browser-checked on desktop and phone against the emulator.
  - **Phase 6 done (2026-10-11):**
    - **Reports screen** (from the design): Year, From and To filters with Apply filters, an Export card with **Download PDF report** and **Export Excel**, "Report includes" checkboxes (Revenue summary, Booking breakdown by pitch, Top repeat clients, Utilisation overview) with a live preview (period revenue, bookings, busiest pitch), a "PDF report ready" notice, a "No data for the selected range" state with Reset filters, and a check that the start month is not after the end month.
    - **No new packages were added.** The PDF and the `.xlsx` are written by two small writers in this repo (`src/lib/pdf.ts` and `src/lib/xlsx.ts`) instead of jsPDF, jspdf-autotable and SheetJS. They load only when someone clicks a download button (about 4 KB and 3 KB gzipped). **The PDF uses the standard Helvetica fonts, which cover Western characters only: any other character (for example Arabic) is drawn as "?" in the PDF. The Excel file keeps every character.** All names in the owner's data are Western today. If that changes, the PDF writer needs an embedded font.
    - **What the files contain:** the PDF has a title band, the sections the person ticked (summary cards, a bar chart drawn with rectangles, tables with repeating headers, a busy-times grid) and "Page n of N" footers. The Excel file has a Summary sheet, one sheet per ticked section, and always a full **Bookings** sheet of the period (the same raw list the old system exported). The old "AI Analysis" template text is not included and nothing is called AI.
    - **Rules:** same as the Dashboard (`src/lib/report.ts` reuses `src/lib/dashboard.ts`): cancelled bookings are left out, revenue counts confirmed bookings (no status = confirmed). Reports are open to staff as well as admins (staff can already read every booking); restrict to admins if the owner wants.
    - **Verified from the outside:** PDFs were rendered with macOS Quick Look and checked by eye; the `.xlsx` was opened with Python's own zip and XML parsers and every figure matched an independent calculation on the real bookings (January to October 2026: 159 bookings, AED 223,125.60); the downloads were captured in the running page and are byte-identical to the files generated outside it. 118 unit tests.
  - **Speed pass (2026-10-11), after the owner reported slow pages.** Measured first: the database is in Qatar (me-central1), so distance was not the problem; each Google service call takes roughly 0.25 to 0.45 s, and the app made 2 to 4 of them, in a line, every time a page opened, with no memory of what it had just loaded. With every call delayed by 350 ms in the practice site, each page took **0.7 to 0.8 s even when revisited**. Changes:
    - **Shared memory with quiet refresh** (`src/lib/queryCache.ts`, `useAsyncData` with `cacheKey`): screens show what is remembered at once and refresh in the background; requests already in flight are shared. Same test afterwards: pages show their content in about **0.03 s** (first visit after the start-up prefetch, and revisits). Clicking the instant the app starts, with nothing remembered, is still about 0.8 s because the data really has to be fetched.
    - **Rules for anyone changing this:** cache keys and loaders live in `src/features/bookings/bookings.cache.ts` and `pitches.service.ts` (`PITCHES_KEY`); a week or month inside an already-loaded year is cut out of that year with no database call. **Every service function that writes a booking calls `queryCache.invalidatePrefix("bookings:")` and every pitch write clears `PITCHES_KEY`**; a new write path must do the same, or screens will show stale lists. Bookings are trusted for 20 s before a quiet re-check; pitches and the year list for 5 minutes. The Today screen stays a live feed.
    - **Start-up prefetch** (`src/app/prefetch.ts`): when someone is in, pitches, the year list, this year's bookings and last December load in parallel; the other screens' code is fetched while the browser is idle (`src/app/pageImports.ts`).
    - **Remembered sign-in** (`src/features/auth/profileCache.ts`): the app opens at once for someone approved on this device and checks with the database in the background; if the database disagrees (switched off) the screen changes immediately (tested). This only affects speed: the security rules decide what anyone can read or change.
    - **Page shell:** connections to Google's services are opened early (`preconnect`), the font stylesheet no longer blocks the first paint, and a spinner shows from the first instant instead of a blank page.
    - **Tests:** 134 unit tests and 44 emulator tests (including one that every write clears the remembered bookings).
  - **Next:** every screen in the designs is built. **Cutover (§7) can now happen** with the owner's go-ahead. Remaining before the owner relies on it: the cutover steps themselves (backup, slot backfill on production, create staff accounts, deploy rules and hosting), and any polish the owner asks for.
- **Phase 2, Pitches and settings screen:** `pitches` list with colour and default rate (seeded from the four existing pitch names). Write the **slot backfill script** and an emulator seed script that loads the backup into `bookings`.
- **Phase 3, Bookings:** new, edit and cancel with the **transactional conflict guard**, recurring bookings, list with filters, search, pagination, CSV and Excel export. **Cutover (§7) can happen after this phase**, with the owner's go-ahead.
- **Phase 4, Calendar:** month, week and day views, pitch colour filter, click-to-create.
- **Phase 5, Dashboard:** stat cards, today's timeline, revenue this month, recent bookings, plus the existing "top repeat clients" and "pitch earnings" views.
- **Phase 6, Revenue and reports:** revenue by day, week, month and pitch, plus the PDF performance report the legacy app produced. (The legacy "AI Analysis" is template text, not real AI. Don't claim otherwise.)
- **Phase 7, Hardening:** rules review and tests, index check, quota check, accessibility pass, empty-data walkthrough, handover notes.

**Query discipline (Spark limits):** always query by a bounded date range, paginate lists with `limit()` and `startAfter()`, use `getCountFromServer()` for totals, use `onSnapshot` only for today's view, cache pitches, and commit composite indexes in `firestore.indexes.json` for any multi-field query.

**Definition of done:** matches the design, has loading, empty and error states, works on a phone-width screen, shows no hard-coded data, formats all money in AED through the shared formatter, `npm run build`, `npm run lint` and `npm test` pass, queries are bounded and indexed, security rules cover every collection and field, and **existing bookings still display and total correctly**.

## 9. Decisions and business rules (confirm with the owner, don't assume)

Defaults are in italics and should sit behind settings so they're easy to change.

- Data approach: **use the existing `bookings` documents directly, no copy, additive changes only** (decided 2026-10-11). The old site may go offline at cutover (decided 2026-10-11).
- **Pitch prices are not fixed; each client's rate is negotiated** (decided 2026-10-11). No default is seeded, and a default is optional.
- Project folder: **internal disk** (decided 2026-10-10). Hosting: *Firebase Hosting*. Deploy branch for the legacy site: `main`.
- Do `Half Pitch` and `Fifa Pitch` (or any other pair) physically share space and need to block each other? *No: conflicts are per pitch only, matching current data.*
- Opening hours: *07:00 to 23:00*. Are bookings past midnight allowed? *No.*
- What counts as revenue? *Confirmed bookings only (a missing status counts as confirmed). Pending shown separately, cancelled excluded.*
- **A recurring series with a clash:** the form currently refuses to create the series while any date clashes (the clashing dates are marked in the preview), so the person adjusts the times or the count. The alternative is to create only the free dates. *Refuse for now; owner to say.*
- Payments and deposits tracking (the designs hint at "Payment received"), an activity log, booking requests, a separate clients collection, customer email: *not in the first version* (customer details stay on each booking, as today). Owner to say if payments should come next.
- Booking numbers like `#PS-1042`: *short document id for now.*
- A "Team" screen to add and approve staff: *no, the owner creates accounts in the Firebase console for now.*
- Reports libraries: **none added**; the repo's own PDF and Excel writers are used (2026-10-11).
- When to cut over: *after Phase 3.*
- Staff accounts needed (how many, any beyond the owner): _unknown_.
- Cancellation, deposit and peak-pricing policy: _unknown_.

## 10. Quick reference

- Backup: `python3 scripts/backup_bookings.py` (read-only, output in git-ignored `backups/`).
- Firestore console: https://console.firebase.google.com/project/pitchbookingsystem-6e222
- Legacy site (until cutover): https://ayebaretony.github.io/epbooking/
- The external drive creates macOS `._*` files, which are git-excluded locally. If git reports `non-monotonic index` errors, delete any `._*` files under `.git/`.
- When you finish a task, update this file if you changed the architecture, data model or a decision.
