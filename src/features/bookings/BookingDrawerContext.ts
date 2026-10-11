import { createContext } from "react";
import type { Booking } from "@/types/models";
import type { DrawerPrefill } from "./BookingFormDrawer";

export type BookingDrawerContextValue = {
  // Opens the new-booking panel from anywhere (optionally with a pitch, date or times already filled in)
  openNew: (prefill?: DrawerPrefill) => void;
  openEdit: (booking: Booking) => void;
  // Goes up every time a booking is saved, so screens showing bookings know to reload
  version: number;
};

export const BookingDrawerContext = createContext<BookingDrawerContextValue | null>(null);
