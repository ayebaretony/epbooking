import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyAuthError, validateLogin } from "./validation.ts";

test("validateLogin asks for both fields and a plausible email", () => {
  assert.deepEqual(validateLogin("", ""), { email: "Enter your email.", password: "Enter your password." });
  assert.equal(validateLogin("not-an-email", "x").email, "Enter a valid email address.");
  assert.deepEqual(validateLogin("  name@example.com ", "secret"), {});
});

test("wrong email and wrong password give the same message (no account enumeration)", () => {
  const wrongPassword = friendlyAuthError("auth/wrong-password");
  assert.equal(friendlyAuthError("auth/user-not-found"), wrongPassword);
  assert.equal(friendlyAuthError("auth/invalid-credential"), wrongPassword);
  assert.equal(wrongPassword, "Email or password is incorrect.");
});

test("other failures get their own helpful message, and unknown ones a safe default", () => {
  assert.match(friendlyAuthError("auth/too-many-requests"), /Too many attempts/);
  assert.match(friendlyAuthError("auth/network-request-failed"), /No connection/);
  assert.match(friendlyAuthError(undefined), /try again/);
  assert.match(friendlyAuthError("something-new"), /try again/);
});
