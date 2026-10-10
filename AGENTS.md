# AGENTS.md — Palace Sports Pitch Booking System

Instructions for AI code agents working on this project. Read this fully before changing anything.

## 1. What this is

An internal management portal for **Palace Sports** (football pitch rental, prices in **AED**). It has been in daily production use for about a year, so real business data depends on it.

- **Live site:** https://ayebaretony.github.io/epbooking/ (GitHub Pages)
- **Repo:** `ayebaretony/epbooking` on GitHub. This local folder (`/Volumes/Tony/footballbooking`) started empty. Clone or pull the repo into it before editing, and don't recreate files from memory.
- **Backend:** Firebase project `pitchbookingsystem-6e222`, Cloud Firestore. Config is in `firebase-config.js`.
- **Users:** the owner and staff, who book pitches and read revenue. There is no public customer-facing booking yet.

### Current architecture (as of 2026-10)

- No build step, bundler, package manager or framework. It is static files served as-is.
- `index.html` holds all HTML, CSS and JS (about 500 lines, one inline `<script>`). `firebase-config.js` holds the Firebase web config.
- Libraries load from CDNs:
  - Firebase 9.6.1 **compat** SDK (`firebase-app-compat`, `firebase-firestore-compat`)
  - Chart.js (unpinned)
  - SheetJS `xlsx@0.18.5`
  - jsPDF 2.5.1 and jspdf-autotable 3.5.25
- Three tabs: **Bookings** (form, filters, table), **Dashboard** (revenue cards and chart), **Calendar** (monthly grid with a detail side panel).
- Features: recurring bookings (weekly or monthly), Excel export, PDF "AI Analysis" report.
- Pitches (hard-coded in several places): `Fifa Pitch`, `Junior Football Pitch`, `Airdome`, `Half Pitch`. Default price is 500 AED/hr.

## 2. Prime directive: protect the production data

The Firestore database holds a year of real bookings and revenue history. **Losing, corrupting or silently reshaping it is the worst possible outcome.**

1. **Never** delete, overwrite, bulk-update or "migrate" documents in the live database without the owner's explicit approval in chat for that specific operation.
2. **Never** run any script against the live project (including read-only ones that could be mistaken for writes) without saying what it will do first.
3. Before any schema change or migration:
   - Export a full backup of the `bookings` collection (Firebase console export, or a script that dumps JSON to a local file). Confirm the backup is non-empty and its document count matches.
   - Write the migration as an idempotent script with a `--dry-run` mode. Run the dry run first and show the owner the diff.
   - Prefer **additive** changes (new fields, new collections). Don't rename or remove existing fields.
4. Develop and test against a **separate Firebase project or the Firestore emulator** (`firebase emulators:start`), never the production project. If no dev project exists, creating one is the first task, so ask the owner. Do not point local dev at `pitchbookingsystem-6e222`.
5. Treat deploys as irreversible for the owner's workflow. The live site is the real app, so deploy only when asked, and work on a branch.

## 3. Data model (Firestore)

Collection **`bookings`**, one document per booking. Document IDs are auto-generated. Fields written by the current app:

| Field | Type | Notes |
|---|---|---|
| `pitch` | string | One of the four pitch names above |
| `clientName` | string | Free text. Also the identity used to group "repeat clients" |
| `contact` | string | Phone or email, free text |
| `date` | string | `YYYY-MM-DD`. A **string**, not a Timestamp. Queried with `orderBy("date")` |
| `startTime` | string | `HH:mm` (24h) |
| `endTime` | string | `HH:mm` (24h) |
| `pricePerHour` | number | AED |
| `hours` | number | Computed on write: `(end - start) / 3600000` |
| `totalPayment` | number | Computed on write: `hours * pricePerHour` |

**Verified against a real backup (2026-10-10, 482 documents):** every document has exactly the nine fields above, with no missing fields and consistent types. All `date` values are valid `YYYY-MM-DD` strings and all times are `HH:mm`. `totalPayment == hours * pricePerHour` holds for every document. There are no zero or negative durations and no exact duplicates. Dates run from 2025-04-02 to 2027-01-29, so **future bookings exist** (recurring series). Pitch counts: Fifa Pitch 308, Airdome 107, Junior Football Pitch 44, Half Pitch 23. 8 documents have an empty `contact`. `pricePerHour` is not always 500 (common values include 750, 600, 400, 650, 527.1, 224.07), so never assume a flat rate. Numbers are mixed int and float, so don't assume either. Treat this as a snapshot and re-run the backup script before relying on it.

**Backups:** run `python3 scripts/backup_bookings.py`. It is read-only, pages through the whole collection, cross-checks the count against Firestore, and writes JSON into `backups/` (git-ignored, because it holds client personal data and the repo is public). Run it before any task that could affect data. The latest verified backup is `backups/bookings-20261010-202009.json`. It must be restorable: if you change the schema, also keep a restore or migration script that has been tested on the emulator.

**UI redesign rule:** the owner is redesigning the UI. A redesign may change how bookings are shown and entered, but it must keep reading and writing the fields above exactly as they are (same names, types and formats), so existing data and any not-yet-updated screens keep working. Any new data needs go through additive fields or new collections (see below), agreed with the owner first.

Rules for working with this model:

- **Treat the schema above as a contract.** Old documents must keep rendering. Code must tolerate missing or odd fields: older docs may lack `contact`, `hours` or `totalPayment`, or have inconsistent values. Inspect real data (read-only, and with owner awareness) before assuming a field always exists.
- Keep `date` as a `YYYY-MM-DD` string unless a migration is explicitly approved. Dates and times are the business's local time. Do not store UTC timestamps in these fields.
- Keep `hours` and `totalPayment` as stored values, because the dashboard, Excel export and reports sum `totalPayment` directly. If you change how they're calculated, existing documents must not change.
- New collections (for example `clients`, `pitches`, `payments`, `users`) are fine and preferred over bloating `bookings`. Link them by new fields and leave existing docs alone.
- Recurring bookings are written as N independent documents. There is no series ID. If you add one (for example `seriesId`), make it optional.

## 4. Known issues in the current code

These are verified against the live source. Fix them deliberately and one at a time. Don't mention or change them as a drive-by inside an unrelated task.

**Security (highest priority)**
- **Login is fake.** Username and password are hard-coded in client-side JS (visible to anyone who views the page source on a public repo), and "logged in" is just `localStorage.isLoggedIn = 'true'`. Anyone can bypass it from the console.
- **Firestore security rules are confirmed fully open** (checked by the owner 2026-10-10): `match /{document=**} { allow read, write; }`, which is the Firebase "test mode" default with its expiry condition removed. Anyone who knows the project ID (it is in the public repo) can read, edit and delete every booking, including client names and contact details. The Firebase web `apiKey` in `firebase-config.js` is not a secret, since it is designed to be public, but with open rules nothing else protects the data.
- **Do not simply lock the rules.** The app has no Firebase Auth yet, so locking them now would break the live app for staff. Order of work: backup, then ship Auth in the app, then tighten the rules (§6 step 2).
- **Fix direction:** Firebase Authentication (email/password) plus Firestore rules that require `request.auth != null` (and a role or allow-list for write access). The hard-coded credentials must be removed from the code. They remain in git history, so tell the owner the old password should be treated as compromised and changed everywhere it is reused. **Never print, log or copy those credentials into new files, docs, commits or chat.**
- **XSS:** client names, contact and pitch are interpolated into `innerHTML` and inline `onclick` strings without escaping (table, calendar, details panel). Use `textContent` or DOM APIs, or an escape helper. Never build handlers from `'${id}'` strings.

**Correctness**
- **No double-booking check.** Two bookings for the same pitch and overlapping time can be created. Note that `Half Pitch` and `Fifa Pitch` physically overlap, so conflict rules need the owner's input.
- **Overnight and invalid times:** if `endTime <= startTime`, hours come out negative or zero. Validate. Decide with the owner whether past-midnight bookings are allowed.
- **Date handling bugs:** `new Date('YYYY-MM-DD')` is parsed as UTC, and recurring bookings use `toISOString()` (UTC), so dates can shift by a day in some timezones. Do date math on `YYYY-MM-DD` strings or with local-time constructors. Monthly recurrence via `setMonth` also drifts (Jan 31 becomes Mar 3).
- **Validation gaps:** the form only checks pitch, client and date. It does not require contact or times, and does not check price or count bounds.
- **"Repeat client" logic** counts all-time bookings by exact `clientName` string, so "John" and "john " are different clients. A real `clients` entity would fix this.
- **Hard-coded year filters** (`2025`, `2026`) in the Bookings tab. Derive years from data.
- **Delete is permanent** and has no undo. Prefer soft delete (`deletedAt` or `status: 'cancelled'`) for new work.
- Calendar colours are random per page load. Make them deterministic (hash of client name).
- The "AI Analysis" report is not AI. It is a few template rules over the data. Don't claim otherwise in the UI or docs, and don't wire a real LLM in without the owner's approval (privacy and cost).

**Performance and structure**
- `db.getAll()` downloads the **entire collection on every render** (each tab, each calendar navigation, each dashboard refresh). Cost and latency grow with the data. Fix by caching, using range queries (`where('date','>=',…)`), and `onSnapshot` for live updates.
- Every write ends in `location.reload()`. Replace with in-place state updates.
- One 500-line file with inline handlers and global `window.delBooking`. Split it when the owner wants (see §6).

## 5. Working agreements for agents

**Process**
- **Read before writing.** Open the files you'll touch. Don't rewrite files wholesale, and make focused diffs.
- **Small, reviewable changes**, one concern per commit or branch. Use branches such as `feat/...` and `fix/...`. Don't commit directly to the deployed branch (probably `main`) unless the owner says to.
- **Ask before** adding dependencies, changing the hosting or deploy method, introducing a framework or build tooling, changing the data model, or touching anything in §2.
- **Don't invent requirements.** If a business rule is unclear (pricing tiers, deposits, cancellation policy, pitch overlap), ask and record the answer in §7.
- Report outcomes honestly. If something wasn't tested, or only worked on the emulator, say so.

**Code style**
- Match the existing style (2-space or 4-space as the file already does, `const`/`let`, async/await, plain DOM APIs).
- Keep the app working as a **static site on GitHub Pages**. No server-only code unless the owner approves an architecture change (for example Cloud Functions).
- Pin CDN library versions. Don't add unpinned `@latest` URLs.
- Keep the Firebase SDK use consistent: it is v9 **compat** now. Moving to the modular SDK is a separate, deliberate migration.
- Mobile matters: staff use phones at the pitch. Keep layouts responsive and tap targets large.
- Currency is AED. Format with `toLocaleString` and two decimals for money, consistently.
- UI copy: plain English, short, no jargon.

**Secrets and privacy**
- Don't put real client names, phone numbers or emails in code, tests, screenshots, commit messages or chat. Use obviously fake test data (`Test Client`, `+971500000000`).
- Never commit service-account keys, admin credentials, `.env` files or database exports. Add backups and exports to `.gitignore`.
- Client contact details are personal data. Don't expose them on any public page.

**Testing**
- There are no automated tests today. For any logic you add or change (hours and price calculation, overlap detection, recurrence, date handling), extract it into pure functions and add tests (Vitest or Node's built-in test runner is fine, once the owner approves tooling).
- Manually verify in a browser against the **emulator or dev project**: create a booking, create a recurring series, delete one, check the dashboard totals, calendar, filters, Excel export and PDF report.
- Before declaring work done, confirm that **existing documents still render** (open the Bookings, Dashboard and Calendar tabs on data that includes old records).

## 6. Suggested roadmap (confirm priority with the owner)

1. **Safety net:** document and test backup and restore. Create a dev Firebase project or emulator setup. Pull the repo locally.
2. **Real authentication** and tightened Firestore rules (§4). Remove the hard-coded credentials.
3. **Escape all rendered user data** (XSS) and add input validation.
4. **Conflict detection** (no double-booking) and time validation.
5. **Fix date and timezone handling**, and recurrence edge cases.
6. **Data access layer:** cached or range queries and live snapshots instead of re-fetching everything, with no page reloads.
7. **Editing bookings** (today it's only create and delete), plus soft-delete or cancel and a status field (`confirmed`, `cancelled`, `no-show`).
8. **Payments tracking:** deposit, paid, balance (new field and collection, additive only).
9. **Clients:** a `clients` collection for dedupe, history and loyalty.
10. **Config in data, not code:** pitches, prices and opening hours in Firestore or one config module instead of copies in the HTML.
11. **Code organisation:** split into `index.html`, `styles.css` and ES modules (still static, no build step unless approved).
12. **Nice-to-haves:** WhatsApp or SMS reminders (via approved services), a public availability view, better reports and CSV or Excel import, PWA install on phones.

## 7. Decisions and business rules (fill in as the owner confirms)

- Deploy branch: `main` (GitHub Pages serves the live site from the repo). The repo is **public**, so never commit secrets or data exports.
- This folder is on an external drive that creates macOS `._*` files. They are git-excluded locally (`.git/info/exclude`). If git reports `non-monotonic index` errors, delete any `._*` files under `.git/`.
- Dev Firebase project / emulator: _none yet_
- Do `Half Pitch` and `Fifa Pitch` conflict with each other? _unknown_
- Are bookings past midnight allowed? _unknown_
- Standard price list / peak pricing: _unknown (default 500 AED/hr)_
- Cancellation / deposit policy: _unknown_
- Who needs access (roles)? _unknown_

## 8. Quick reference

- Run locally: serve the folder statically (for example `python3 -m http.server 8000`) and open http://localhost:8000. Remember that this still talks to whichever Firebase project is in `firebase-config.js`. Use a dev config for local work (§2.4).
- Firestore console: https://console.firebase.google.com/project/pitchbookingsystem-6e222
- When you finish a task, update this file if you changed the architecture, data model, or a known-issue status, and tick off the roadmap.
