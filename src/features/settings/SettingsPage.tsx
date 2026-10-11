import { Button } from "@/components/ui/Button";
import { signOut } from "@/features/auth/auth.service";

// Placeholder until Phase 2 (profile, pitches, preferences). Sign out lives here, as in the design.
export function SettingsPage() {
  return (
    <div>
      <h1 className="text-display font-bold">Settings</h1>
      <p className="mt-2 text-sm text-muted">Profile, pitches and preferences are built in Phase 2.</p>
      <Button variant="secondary" className="mt-6" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
