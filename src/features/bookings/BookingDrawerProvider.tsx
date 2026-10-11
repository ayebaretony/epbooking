import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Booking } from "@/types/models";
import { BookingDrawerContext, type BookingDrawerContextValue } from "./BookingDrawerContext";
import { BookingFormDrawer, type DrawerPrefill } from "./BookingFormDrawer";

type Open = { booking: Booking | null; prefill?: DrawerPrefill; key: number };

// Owns the new / edit booking panel, so any screen can open it, and tells screens to reload when a booking is saved
export function BookingDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [version, setVersion] = useState(0);

  const openNew = useCallback((prefill?: DrawerPrefill) => setOpen({ booking: null, prefill, key: Date.now() }), []);
  const openEdit = useCallback((booking: Booking) => setOpen({ booking, key: Date.now() }), []);

  const value = useMemo<BookingDrawerContextValue>(() => ({ openNew, openEdit, version }), [openNew, openEdit, version]);

  return (
    <BookingDrawerContext.Provider value={value}>
      {children}
      {open ? <BookingFormDrawer key={open.key} booking={open.booking} prefill={open.prefill} onClose={() => setOpen(null)} onSaved={() => setVersion((current) => current + 1)} /> : null}
    </BookingDrawerContext.Provider>
  );
}
