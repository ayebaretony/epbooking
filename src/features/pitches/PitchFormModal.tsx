import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { PITCH_COLOR_KEYS, nextUnusedColor } from "@/lib/pitchColors";
import { aedToFils, minorToMajorInput } from "@/lib/money";
import type { Pitch } from "@/types/models";
import { ColorDot } from "./PitchTag";
import { createPitch, updatePitch } from "./pitches.service";
import { validatePitchForm, type PitchFormErrors } from "./pitch.validation";

type Props = {
  // The pitch being edited, or null to add a new one
  pitch: Pitch | null;
  existing: readonly Pitch[];
  onClose: () => void;
  onSaved: () => void;
};

export function PitchFormModal({ pitch, existing, onClose, onSaved }: Props) {
  const editing = pitch !== null;
  const toast = useToast();
  const [name, setName] = useState(pitch?.name ?? "");
  const [description, setDescription] = useState(pitch?.description ?? "");
  const [rate, setRate] = useState(pitch?.defaultRatePerHour === undefined ? "" : minorToMajorInput(aedToFils(pitch.defaultRatePerHour)));
  const [color, setColor] = useState(pitch?.color ?? nextUnusedColor(existing.map((p) => p.color)));
  const [errors, setErrors] = useState<PitchFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const result = validatePitchForm({ name, description, rate, color }, existing.map((p) => p.id), editing);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (pitch) await updatePitch(pitch.id, result.value);
      else await createPitch(result.value, existing);
      toast.show(editing ? "Pitch updated" : "Pitch added");
      onSaved();
      onClose();
    } catch (error) {
      const code = (error as { code?: string }).code;
      setSaveError(code === "permission-denied" ? "You don't have permission to change pitches." : (error as Error).message || "We couldn't save this pitch. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit pitch" : "Add pitch"} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Pitch name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          // Bookings refer to a pitch by its name, so a saved pitch can't be renamed
          disabled={editing}
          autoFocus={!editing}
        />
        {editing ? <p className="-mt-2 text-xs text-muted">The name can’t be changed, because existing bookings use it.</p> : null}
        <Input label="Description (optional)" placeholder="e.g. 11-a-side" value={description} onChange={(event) => setDescription(event.target.value)} error={errors.description} />
        <div>
          <Input
            label="Default price per hour, AED (optional)"
            inputMode="decimal"
            placeholder="Not set"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            error={errors.rate}
          />
          <p className="mt-1.5 text-xs text-muted">Leave empty if prices are negotiated. Each booking always has its own price.</p>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {PITCH_COLOR_KEYS.map((key) => (
              <label key={key} className="cursor-pointer">
                <input type="radio" name="color" value={key} checked={color === key} onChange={() => setColor(key)} className="peer sr-only" />
                <span className="flex size-9 items-center justify-center rounded-full border border-line peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  <ColorDot color={key} className="size-5" />
                  <span className="sr-only">{key}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.color ? <p className="mt-1.5 text-xs text-danger">{errors.color}</p> : null}
        </fieldset>

        {saveError ? (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2.5 text-xs text-danger">
            {saveError}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add pitch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
