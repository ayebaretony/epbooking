import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BrandMark } from "./BrandMark";
import { signOut } from "./auth.service";
import type { ReactNode } from "react";

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-4">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">{children}</Card>
    </main>
  );
}

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page" role="status" aria-live="polite">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </main>
  );
}

// Signed in, but the owner has not approved this account yet (no users/{uid} document, or it is switched off)
export function AccountPendingScreen({ email, onCheckAgain }: { email: string | null; onCheckAgain: () => void }) {
  return (
    <Centered>
      <BrandMark />
      <h1 className="text-heading font-semibold">Your account is waiting for approval</h1>
      <p className="text-sm text-muted">
        {email ? `You're signed in as ${email}, but ` : "You're signed in, but "}
        the owner hasn't activated your access yet. Ask them to approve your account, then check again.
      </p>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button className="w-full sm:flex-1" onClick={onCheckAgain}>
          Check again
        </Button>
        <Button variant="secondary" className="w-full sm:flex-1" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </Centered>
  );
}

// Couldn't check the approval (usually no internet)
export function CheckFailedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Centered>
      <TriangleAlert className="size-8 text-warning" aria-hidden="true" />
      <h1 className="text-heading font-semibold">We couldn't load your account</h1>
      <p className="text-sm text-muted">Check your internet connection and try again.</p>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button className="w-full sm:flex-1" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="secondary" className="w-full sm:flex-1" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </Centered>
  );
}

// Shown instead of the app when the Firebase settings in .env.local are missing (and the emulators are not on)
export function ConfigMissingScreen({ missing }: { missing: string[] }) {
  return (
    <Centered>
      <TriangleAlert className="size-8 text-warning" aria-hidden="true" />
      <h1 className="text-heading font-semibold">Setup needed</h1>
      <p className="text-sm text-muted">
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in these values, or switch on practice mode with{" "}
        <code>VITE_USE_EMULATORS=true</code>.
      </p>
      <ul className="w-full rounded-lg bg-sidebar p-3 text-left font-mono text-xs">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </Centered>
  );
}
