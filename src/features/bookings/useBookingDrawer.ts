import { useContext } from "react";
import { BookingDrawerContext, type BookingDrawerContextValue } from "./BookingDrawerContext";

export function useBookingDrawer(): BookingDrawerContextValue {
  const value = useContext(BookingDrawerContext);
  if (!value) throw new Error("useBookingDrawer must be used inside <BookingDrawerProvider>");
  return value;
}
