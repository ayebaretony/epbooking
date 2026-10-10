import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

// Emulator mode only works in `npm run dev`. A production build can never point at the emulators,
// even if VITE_USE_EMULATORS was left switched on in .env.local.
export const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true";

// The emulators run as a fake project, so the real project (pitchbookingsystem-6e222) is never touched in this mode.
const EMULATOR_PROJECT_ID = "demo-epbooking";

const env = import.meta.env;
const realConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// Names of the .env.local values that are still empty, so a setup screen can be shown instead of a broken app.
export const missingFirebaseConfig: string[] = useEmulators
  ? []
  : Object.entries({
      VITE_FIREBASE_API_KEY: realConfig.apiKey,
      VITE_FIREBASE_AUTH_DOMAIN: realConfig.authDomain,
      VITE_FIREBASE_PROJECT_ID: realConfig.projectId,
      VITE_FIREBASE_APP_ID: realConfig.appId,
    })
      .filter(([, value]) => !value)
      .map(([name]) => name);

const app = initializeApp(
  useEmulators
    ? { apiKey: "demo-key", authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`, projectId: EMULATOR_PROJECT_ID, appId: "demo-app" }
    : // "not-configured" only keeps initialisation from throwing while a setup screen would be showing
      { ...realConfig, apiKey: realConfig.apiKey || "not-configured" },
);

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
