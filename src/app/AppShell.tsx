import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/Skeleton";
import { BookingDrawerProvider } from "@/features/bookings/BookingDrawerProvider";
import { BottomTabs } from "./BottomTabs";
import { Sidebar } from "./Sidebar";

// Sidebar on desktop, top bar plus bottom tabs on phones (the layouts in the designs). The booking panel lives here,
// so "New booking" can be opened from any screen.
export function AppShell() {
  return (
    <BookingDrawerProvider>
      <div className="flex min-h-screen bg-page">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-line bg-surface px-4 py-3 text-base font-bold text-primary md:hidden">Palace Sports</header>
          <main id="content" className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
            <Suspense fallback={<Skeleton className="h-64" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <BottomTabs />
      </div>
    </BookingDrawerProvider>
  );
}
