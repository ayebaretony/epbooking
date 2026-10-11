// How each screen is loaded. Screens are loaded the first time they are opened, and (once the person is in) the rest are
// fetched quietly while the browser is idle, so moving to another page does not wait for a download.
export const pageImports = {
  bookings: () => import("@/features/bookings/BookingsPage"),
  bookingDetails: () => import("@/features/bookings/BookingDetailsPage"),
  calendar: () => import("@/features/calendar/CalendarPage"),
  dashboard: () => import("@/features/dashboard/DashboardPage"),
  reports: () => import("@/features/reports/ReportsPage"),
  settings: () => import("@/features/settings/SettingsPage"),
};

export function prefetchPages(): void {
  const run = () => Object.values(pageImports).forEach((load) => void load().catch(() => undefined));
  const idle = (window as { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 1500);
}
