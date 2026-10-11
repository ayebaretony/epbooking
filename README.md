# Palace Sports — pitch booking (React rebuild)

React + TypeScript + Vite + Tailwind + Firebase (modular SDK). Read `AGENTS.md` first: it holds the plan, the data rules and the cutover sequence.

The old single-file app lives in `legacy/` (the live site is still served from `main`). This branch does not touch it.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run emulators` | Start the Firebase emulators (Auth + Firestore) as the fake project `demo-epbooking` |
| `npm run dev` | Start the app. With `VITE_USE_EMULATORS=true` (the default in `.env.example`) it talks only to the emulators |
| `npm test` | Unit tests for money, slot and date logic (Node's built-in test runner, no extra dependency) |
| `npm run test:rules` | Security-rules tests against the emulators (needs Java). Set `BACKUP_FILE=/path/to/bookings-….json` (a simplified backup) to also prove every real booking is accepted |
| `npm run build` | Type-check and build |
| `npm run lint` | ESLint |

## First-time setup

1. `cp .env.example .env.local`
2. The Firestore emulator needs **Java** (JDK 17 or newer). Check with `java -version`. Install with `brew install --cask temurin` if it is missing.
3. `npm run emulators` in one terminal, `npm run dev` in another. (If port 5173 is busy, Vite picks the next free one and prints it.)
4. Fill the practice emulator with your real bookings (from a backup made by `scripts/backup_bookings.py`), the pitches, the slot documents and two fake test users: `node scripts/seed_emulator.ts --backup /path/to/bookings-….json --reset` (add `--demo-today` to also get a few fake bookings dated today, so the Today screen has something to show). (The backup holds client personal data, so keep it out of git.)
   Or just create a fake test person in the emulator, then sign in at the printed address:
   - `node scripts/seed_emulator_user.mjs` makes an approved admin, `--role staff` a staff member, and `--inactive` someone who has signed up but is not approved yet (to see the waiting screen). The values only exist inside the emulator.

## Live site

- **GitHub Pages** (`ayebaretony.github.io/epbooking`) serves only `docs/index.html`, a notice that redirects to the new site. Everything in `docs/` is public, so keep it to that one page. The root `index.html` is the React app's entry file, not a web page for Pages.
- The new app is live at **https://pitchbookingsystem-6e222.web.app** (Firebase Hosting, free plan), using the real project `pitchbookingsystem-6e222`. The cutover from the old site happened on 2026-10-11 (see `AGENTS.md` section 7).
- `npm run deploy:hosting` builds and publishes the site. It needs `.env.production.local` (git-ignored, the project's public web settings, `VITE_USE_EMULATORS=false`).
- `npm run deploy:rules` publishes `firestore.rules`. That changes who can read the real bookings, so only do it with the owner's go-ahead, after `npm run test:rules` passes against a recent backup.
- **Emergency rollback of the rules:** copy `rollback/firestore.rules.legacy-open` over `firestore.rules` and run `npm run deploy:rules`. That re-opens the database to the whole internet, so put the proper rules back straight away.
- There is deliberately no `.firebaserc`: every command names the project explicitly, so nothing can be deployed to the wrong place by accident.

## Safety

- Never run scripts that write to the real project without the owner's approval, and take a backup first (`python3 scripts/backup_bookings.py`). `scripts/backfill_slots.ts` only writes with `--production --apply --confirm-production`.
- Never write to existing `bookings` documents except when a signed-in person edits, cancels or deletes that one booking in the app.
- Backups contain client personal data. They go in `backups/`, which is git-ignored. The repo is public.
