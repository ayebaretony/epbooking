import { PitchManagementCard } from "./PitchManagementCard";
import { PreferencesCard } from "./PreferencesCard";
import { ProfileCard } from "./ProfileCard";

export function SettingsPage() {
  return (
    <div>
      <h1 className="text-display font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">Manage your workspace and defaults.</p>
      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
        <ProfileCard />
        <PitchManagementCard />
        <PreferencesCard />
      </div>
    </div>
  );
}
