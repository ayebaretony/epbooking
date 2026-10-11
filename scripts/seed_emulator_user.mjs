#!/usr/bin/env node
// Creates a TEST person in the Firebase EMULATORS (never production): a sign-in account plus the users/{uid}
// document that approves them, so the new app can be tried locally. The emulators must be running (`npm run emulators`).
//
//   node scripts/seed_emulator_user.mjs                       admin test user
//   node scripts/seed_emulator_user.mjs --role staff          staff test user
//   node scripts/seed_emulator_user.mjs --inactive            signed up but NOT approved (to see the waiting screen)
//   node scripts/seed_emulator_user.mjs --email a@b.test --password secret123 --name "Someone"
//
// These values only exist inside the emulator. They are not real accounts.
const PROJECT = "demo-epbooking";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const role = option("role", "admin");
const email = option("email", role === "admin" ? "admin@test.local" : "staff@test.local");
const password = option("password", "test-password-123");
const name = option("name", role === "admin" ? "Test Admin" : "Test Staff");
const active = !flag("inactive");

if (!["admin", "staff"].includes(role)) throw new Error('--role must be "admin" or "staff"');

async function createAuthUser() {
  const response = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  if (response.ok) return body.localId;
  if (body.error?.message === "EMAIL_EXISTS") {
    // Already created on an earlier run: look up the existing account's id by signing in
    const signIn = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const signInBody = await signIn.json();
    if (signIn.ok) return signInBody.localId;
    throw new Error(`${email} already exists with a different password`);
  }
  throw new Error(`Could not create the account: ${JSON.stringify(body)}`);
}

async function writeProfile(uid) {
  const response = await fetch(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`, {
    method: "PATCH",
    // "owner" is the emulator's admin token: it bypasses the rules, like creating the document in the console would
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        displayName: { stringValue: name },
        email: { stringValue: email },
        role: { stringValue: role },
        active: { booleanValue: active },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!response.ok) throw new Error(`Could not write the users document: ${await response.text()}`);
}

try {
  const uid = await createAuthUser();
  await writeProfile(uid);
  console.log(`Created ${active ? "approved" : "UNAPPROVED"} ${role} in the emulator: ${email} (password: ${password})`);
} catch (error) {
  console.error(error.message);
  console.error("Is `npm run emulators` running?");
  process.exit(1);
}
