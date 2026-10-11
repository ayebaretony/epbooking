import { CircleUser } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { NAV_ITEMS } from "./navItems";

export function Sidebar() {
  const { state } = useAuth();
  const profile = state.status === "active" ? state.profile : null;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar md:flex">
      <div className="px-5 py-5 text-base font-bold text-primary">Palace Sports</div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                isActive ? "bg-nav-active text-primary" : "text-ink hover:bg-nav-active/60"
              }`
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-line px-4 py-4">
        <CircleUser className="size-8 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{profile?.displayName || profile?.email || "Signed in"}</p>
          <p className="truncate text-xs text-muted">{profile?.role === "admin" ? "Portal Administrator" : "Staff"}</p>
        </div>
      </div>
    </aside>
  );
}
