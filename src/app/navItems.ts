import { BarChart3, CalendarDays, ClipboardList, House, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; mobile: boolean };

// Order and labels follow the designs. Reports is desktop-only, as in the phone design's bottom tab bar.
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Today", icon: House, end: true, mobile: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, mobile: true },
  { to: "/bookings", label: "Bookings", icon: ClipboardList, mobile: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { to: "/reports", label: "Reports", icon: BarChart3, mobile: false },
  { to: "/settings", label: "Settings", icon: Settings, mobile: true },
];
