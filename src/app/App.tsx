import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { BookingDetailsPage } from "@/features/bookings/BookingDetailsPage";
import { BookingsPage } from "@/features/bookings/BookingsPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { PublicOnly, RequireAuth } from "@/features/auth/RouteGuards";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TodayPage } from "@/features/today/TodayPage";
import { AppShell } from "./AppShell";
import { PlaceholderPage } from "./PlaceholderPage";

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
          <Route path="dashboard" element={<PlaceholderPage title="Dashboard" phase="Phase 5" />} />
          <Route path="reports" element={<PlaceholderPage title="Reports" phase="Phase 6" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
