// Plain functions, so they can be unit-tested without a browser.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginErrors = { email?: string; password?: string };

export function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  if (!email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

// Firebase error codes -> something a person can act on. A wrong email and a wrong password get the same message on
// purpose, so the screen never reveals which emails have accounts.
export function friendlyAuthError(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Ask the owner for help.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}
