import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/features/auth/useAuth";
import { updateDisplayName } from "./profile.service";

export function ProfileCard() {
  const { state, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  if (state.status !== "active") return null;
  const { profile, user } = state;

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Profile</h2>
      <p className="mt-0.5 text-xs text-muted">Personal account details</p>
      <p className="mt-4 text-sm font-semibold">{profile.displayName || "No name set"}</p>
      <p className="text-sm text-muted">{profile.email || user.email}</p>
      <Button variant="secondary" className="mt-4" onClick={() => setEditing(true)}>
        Edit profile
      </Button>
      {editing ? <EditProfileModal uid={user.uid} currentName={profile.displayName} onClose={() => setEditing(false)} onSaved={() => void refresh()} /> : null}
    </Card>
  );
}

function EditProfileModal({ uid, currentName, onClose, onSaved }: { uid: string; currentName: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter your name.");
    if (trimmed.length > 100) return setError("Keep your name under 100 characters.");
    setError(null);
    setSaving(true);
    try {
      await updateDisplayName(uid, trimmed);
      toast.show("Profile updated");
      onSaved();
      onClose();
    } catch {
      toast.show("We couldn't update your profile. Please try again.", "error");
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Your name" value={name} onChange={(event) => setName(event.target.value)} error={error} autoFocus />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
