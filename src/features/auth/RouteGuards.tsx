import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AccountPendingScreen, CheckFailedScreen, LoadingScreen } from "./StatusScreens";
import { useAuth } from "./useAuth";

// Everything inside needs an approved, signed-in person. Anyone else sees the right screen instead.
export function RequireAuth() {
  const { state, refresh } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case "loading":
      return <LoadingScreen />;
    case "signedOut":
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    case "noProfile":
    case "inactive":
      return <AccountPendingScreen email={state.user.email} onCheckAgain={() => void refresh()} />;
    case "error":
      return <CheckFailedScreen onRetry={() => void refresh()} />;
    case "active":
      return <Outlet />;
  }
}

// The sign-in page itself: people who are already in are sent on to the app
export function PublicOnly() {
  const { state } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "signedOut") return <Outlet />;
  return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
}
