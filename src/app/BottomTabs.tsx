import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";

// Phone navigation, as in the mobile designs
export function BottomTabs() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {NAV_ITEMS.filter((item) => item.mobile).map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={end} className="flex flex-col items-center gap-0.5 px-1 py-2 text-caption font-medium">
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-lg ${isActive ? "bg-primary text-white" : "text-muted"}`}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className={isActive ? "text-primary" : "text-muted"}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
