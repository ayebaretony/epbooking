import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { PublicOnly, RequireAuth } from "@/features/auth/RouteGuards";
import { TodayPage } from "@/features/today/TodayPage";
import { AppShell } from "./AppShell";
import { pageImports } from "./pageImports";

// Each screen is loaded when it is first opened (and fetched quietly ahead of time once someone is in: see pageImports.ts), so
// the heavy ones (the Dashboard's charts) don't slow down everything else.
const BookingDetailsPage = lazy(() => pageImports.bookingDetails().then((m) => ({ default: m.BookingDetailsPage })));
const BookingsPage = lazy(() => pageImports.bookings().then((m) => ({ default: m.BookingsPage })));
const CalendarPage = lazy(() => pageImports.calendar().then((m) => ({ default: m.CalendarPage })));
const DashboardPage = lazy(() => pageImports.dashboard().then((m) => ({ default: m.DashboardPage })));
const ReportsPage = lazy(() => pageImports.reports().then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => pageImports.settings().then((m) => ({ default: m.SettingsPage })));

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/:id" element={<BookingDetailsPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
