import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { PublicOnly, RequireAuth } from "@/features/auth/RouteGuards";
import { TodayPage } from "@/features/today/TodayPage";
import { AppShell } from "./AppShell";
import { PlaceholderPage } from "./PlaceholderPage";

// Each screen is loaded when it is first opened, so the heavy ones (the Dashboard's charts) don't slow down everything else.
const BookingDetailsPage = lazy(() => import("@/features/bookings/BookingDetailsPage").then((m) => ({ default: m.BookingDetailsPage })));
const BookingsPage = lazy(() => import("@/features/bookings/BookingsPage").then((m) => ({ default: m.BookingsPage })));
const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));

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
          <Route path="reports" element={<PlaceholderPage title="Reports" phase="Phase 6" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
