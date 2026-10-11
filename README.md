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
3. `npm run emulators` in one terminal, `npm run dev` in another.

## Safety

- **Never deploy this project's Firebase rules or hosting to `pitchbookingsystem-6e222` until the cutover in `AGENTS.md` section 7 is approved.** The live legacy app has no sign-in and would be locked out. For that reason there is deliberately no `.firebaserc` and no deploy script.
- Never run scripts against production without the owner's approval, and run `python3 scripts/backup_bookings.py` first.
- Backups contain client personal data. They go in `backups/`, which is git-ignored. The repo is public.
