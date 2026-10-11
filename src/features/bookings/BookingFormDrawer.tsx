import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/useToast";
import { useAuth } from "@/features/auth/useAuth";
import { PitchTag } from "@/features/pitches/PitchTag";
import { usePitches } from "@/features/pitches/usePitches";
import { durationMinutes, formatHours, minutesToTime, priceBooking, timeToMinutes } from "@/lib/bookingMath";
import { formatDateWithDay } from "@/lib/dateFormat";
import { db } from "@/lib/firebase";
import { aedToFils, formatMoney, parseMajorToMinor } from "@/lib/money";
import { readDefaultDuration } from "@/lib/preferences";
import { MAX_OCCURRENCES, MIN_OCCURRENCES, occurrenceDates, type RecurrenceType } from "@/lib/recurrence";
import { todayInTimezone } from "@/lib/time";
import { DEFAULT_CENTER_SETTINGS } from "@/types/models";
import type { Booking } from "@/types/models";
import { rateText, validateBookingForm, type BookingFormErrors, type BookingFormValues } from "./booking.validation";
import { SlotConflictError, createBooking, createSeries, updateBooking } from "./bookings.service";
import { useSlotAvailability } from "./hooks/useSlotAvailability";

export type DrawerPrefill = Partial<Pick<BookingFormValues, "pitch" | "date" | "startTime" | "endTime">>;

type Props = {
  // A new booking (optionally with some fields filled in, e.g. from a calendar slot) or an existing one to edit
  booking: Booking | null;
  prefill?: DrawerPrefill;
  onClose: () => void;
  onSaved: () => void;
};

const SETTINGS = DEFAULT_CENTER_SETTINGS;
const OPEN_MINUTES = timeToMinutes(SETTINGS.openTime) ?? 420;
const CLOSE_MINUTES = timeToMinutes(SETTINGS.closeTime) ?? 1380;

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function BookingFormDrawer({ booking, prefill, onClose, onSaved }: Props) {
  const editing = booking !== null;
  const toast = useToast();
  const { state: auth } = useAuth();
  const { state: pitchState } = usePitches();
  const pitches = pitchState.status === "ready" ? pitchState.data : [];
  // Pitches that can be chosen: the active ones, plus the booking's own pitch if it has since been archived
  const choices = pitches.filter((pitch) => !pitch.archived || pitch.name === booking?.pitch);

  const [values, setValues] = useState<BookingFormValues>(() => ({
    pitch: booking?.pitch ?? prefill?.pitch ?? "",
    clientName: booking?.clientName ?? "",
    contact: booking?.contact ?? "",
    date: booking?.date ?? prefill?.date ?? todayInTimezone(SETTINGS.timezone),
    startTime: booking?.startTime ?? prefill?.startTime ?? "",
    endTime: booking?.endTime ?? prefill?.endTime ?? "",
    rate: booking ? rateText(booking.pricePerHour) : "",
    recurrence: "none",
    count: "4",
  }));
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BookingFormValues>(key: K, value: BookingFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaveError(null);
  }

  function onPitchChange(name: string) {
    setValues((current) => {
      const chosen = pitches.find((pitch) => pitch.name === name);
      // A pitch's default price (if the owner set one) only fills an EMPTY price box. It is never guessed otherwise.
      const rate = !editing && current.rate.trim() === "" && chosen?.defaultRatePerHour !== undefined ? rateText(chosen.defaultRatePerHour) : current.rate;
      return { ...current, pitch: name, rate };
    });
    setErrors((current) => ({ ...current, pitch: undefined, rate: undefined }));
    setSaveError(null);
  }

  function onStartChange(startTime: string) {
    setValues((current) => {
      // Fill in the end time from the default duration (a per-device preference) when it is still empty
      const start = timeToMinutes(startTime);
      let endTime = current.endTime;
      if (!editing && endTime === "" && start !== null) {
        const end = start + readDefaultDuration(browserStorage());
        if (end <= CLOSE_MINUTES) endTime = minutesToTime(end);
      }
      return { ...current, startTime, endTime };
    });
    setErrors((current) => ({ ...current, startTime: undefined, endTime: undefined }));
    setSaveError(null);
  }

  // The dates this form will create, and the live price
  const count = Number(values.count);
  const countOk = Number.isInteger(count) && count >= MIN_OCCURRENCES && count <= MAX_OCCURRENCES;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(values.date);
  const recurring = !editing && values.recurrence !== "none";
  const dates = !dateOk ? [] : recurring ? (countOk ? occurrenceDates(values.date, values.recurrence, count) : []) : [values.date];
  const rateFils = values.rate.trim() === "" ? null : parseMajorToMinor(values.rate);
  const pricing = rateFils === null ? null : priceBooking(rateFils, values.startTime, values.endTime);

  // Availability only needs the pitch, the dates and valid half-hour times. It does not wait for a price.
  const startMinutes = timeToMinutes(values.startTime);
  const endMinutes = timeToMinutes(values.endTime);
  const timesOk = durationMinutes(values.startTime, values.endTime) !== null && startMinutes! % 30 === 0 && endMinutes! % 30 === 0;
  const availability = useSlotAvailability(Boolean(values.pitch) && timesOk && dates.length > 0, values.pitch, dates.join(","), values.startTime, values.endTime, booking?.id);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const result = validateBookingForm(values, {
      pitchNames: choices.map((pitch) => pitch.name),
      openMinutes: OPEN_MINUTES,
      closeMinutes: CLOSE_MINUTES,
      requireContact: !editing || booking.contact !== "",
      allowRecurrence: !editing,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (availability.status === "conflict") {
      setSaveError("That time is already booked. Choose another time or pitch.");
      return;
    }
    if (auth.status !== "active") return;

    setErrors({});
    setSaving(true);
    const author = { uid: auth.user.uid, name: auth.profile.displayName || auth.profile.email };
    try {
      if (booking) {
        await updateBooking(db, booking, result.value);
        toast.show("Booking updated");
      } else if (result.recurrence === "none") {
        await createBooking(db, author, result.value);
        toast.show("Booking created successfully");
      } else {
        const series = await createSeries(db, author, result.value, result.dates);
        if (series.failed.length === 0) toast.show(`${series.created.length} bookings created`);
        else
          toast.show(`${series.created.length} of ${result.dates.length} created. Not booked: ${series.failed.map((f) => formatDateWithDay(f.date)).join(", ")} (${series.failed[0].reason}).`, "error");
      }
      onSaved();
      onClose();
    } catch (error) {
      const code = (error as { code?: string }).code;
      setSaveError(
        error instanceof SlotConflictError
          ? "That time is no longer available. Someone else just booked it."
          : code === "permission-denied"
            ? "You don't have permission to do that."
            : "We couldn't save this booking. Check your connection and try again.",
      );
      setSaving(false);
    }
  }

  const chosenPitch = pitches.find((pitch) => pitch.name === values.pitch);

  return (
    <Modal title={editing ? "Edit booking" : "New booking"} onClose={onClose} variant="drawer">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <Select label="Pitch *" value={values.pitch} onChange={(event) => onPitchChange(event.target.value)} aria-invalid={errors.pitch ? true : undefined}>
            <option value="">Select a pitch</option>
            {choices.map((pitch) => (
              <option key={pitch.id} value={pitch.name}>
                {pitch.name}
              </option>
            ))}
          </Select>
          {errors.pitch ? <p className="mt-1.5 text-xs text-danger">{errors.pitch}</p> : null}
          {chosenPitch ? (
            <div className="mt-2">
              <PitchTag name={chosenPitch.name} color={chosenPitch.color} />
            </div>
          ) : null}
          {pitchState.status === "error" ? <p className="mt-1.5 text-xs text-danger">We couldn't load the pitches. Close this and try again.</p> : null}
        </div>

        <Input label="Client name *" placeholder="Full name" value={values.clientName} onChange={(event) => set("clientName", event.target.value)} error={errors.clientName} />
        <Input label="Contact phone or email *" placeholder="+971 50 000 0000" value={values.contact} onChange={(event) => set("contact", event.target.value)} error={errors.contact} />

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Input label="Date" type="date" value={values.date} onChange={(event) => set("date", event.target.value)} error={errors.date} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Input label="Price per hour (AED) *" inputMode="decimal" placeholder="Enter price" value={values.rate} onChange={(event) => set("rate", event.target.value)} error={errors.rate} />
          </div>
          <Input label="Start" type="time" step={1800} value={values.startTime} onChange={(event) => onStartChange(event.target.value)} error={errors.startTime} />
          <Input label="End" type="time" step={1800} value={values.endTime} onChange={(event) => set("endTime", event.target.value)} error={errors.endTime} />
        </div>

        <AvailabilityLine availability={availability} recurring={recurring} />

        <div className="rounded-xl bg-sidebar p-4" aria-live="polite">
          <p className="text-sm font-semibold">Summary</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted">Total hours</p>
              <p className="text-base font-semibold">{pricing ? formatHours(pricing.hours) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Total payment</p>
              <p className="text-base font-semibold">{pricing ? formatMoney(aedToFils(pricing.totalPayment), SETTINGS.currency) : "—"}</p>
            </div>
          </div>
          {recurring && pricing && dates.length > 1 ? <p className="mt-3 text-xs text-muted">Per booking. {dates.length} bookings in total.</p> : null}
        </div>

        {!editing ? (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium">Recurring</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-sidebar p-1">
              {(["none", "weekly", "monthly"] as RecurrenceType[]).map((type) => (
                <label key={type} className="cursor-pointer">
                  <input type="radio" name="recurrence" value={type} checked={values.recurrence === type} onChange={() => set("recurrence", type)} className="peer sr-only" />
                  <span className="flex h-9 items-center justify-center rounded-md text-xs font-medium capitalize text-muted peer-checked:bg-nav-active peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                    {type === "none" ? "None" : type}
                  </span>
                </label>
              ))}
            </div>
            {recurring ? (
              <div className="mt-3 flex flex-col gap-3">
                <Input label="How many times?" type="number" min={MIN_OCCURRENCES} max={MAX_OCCURRENCES} value={values.count} onChange={(event) => set("count", event.target.value)} error={errors.count} />
                {dates.length > 0 ? <DatesPreview dates={dates} clashes={availability.status === "conflict" ? availability.dates : []} /> : null}
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {saveError ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-tint px-3 py-2.5 text-xs text-danger">
            <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            {saveError}
          </p>
        ) : null}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-line bg-surface px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={availability.status === "conflict"}>
            {saving ? "Saving…" : editing ? "Save changes" : recurring && dates.length > 1 ? `Create ${dates.length} bookings` : "Create booking"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AvailabilityLine({ availability, recurring }: { availability: ReturnType<typeof useSlotAvailability>; recurring: boolean }) {
  if (availability.status === "idle") return null;
  if (availability.status === "checking")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Checking availability…
      </p>
    );
  if (availability.status === "available")
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-success" role="status">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        {recurring ? "Every date is available" : "Slot available"}
      </p>
    );
  if (availability.status === "conflict")
    return (
      <p className="flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {recurring ? `Already booked on ${availability.dates.length} of these dates (marked below).` : "This pitch is already booked at that time."}
      </p>
    );
  return (
    <p className="text-xs text-muted" role="status">
      Couldn't check availability. It will be checked again when you save.
    </p>
  );
}

function DatesPreview({ dates, clashes }: { dates: string[]; clashes: string[] }) {
  return (
    <div className="rounded-xl bg-sidebar p-3">
      <p className="text-xs font-medium">Dates created</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
        {dates.map((date) => (
          <li key={date} className={`flex items-center justify-between ${clashes.includes(date) ? "font-medium text-danger" : ""}`}>
            <span>{formatDateWithDay(date)}</span>
            {clashes.includes(date) ? <span>already booked</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
