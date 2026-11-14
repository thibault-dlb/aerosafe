import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import ChangePassword from "@/components/auth/ChangePassword";
import SessionLoading from "@/components/auth/SessionLoading";
import { useAuth } from "@/hooks/useAuth";
import { AuthRedirect } from "@/services/AuthRedirect";

export interface RequireAuthProps {
  /** What to protect. Without it, the child routes of the route this is the element of. */
  children?: ReactNode;
}

/**
 * Lets a logged in visitor through; the others go to the log in screen and come back afterwards.
 * An account that still has a provisional password only gets the screen that replaces it.
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <SessionLoading />;
  }
  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={AuthRedirect.state(from)} />;
  }
  // A provisional password blocks the whole application: the API refuses every other route as well.
  if (user?.mustChangePassword) {
    return <ChangePassword />;
  }
  return <>{children ?? <Outlet />}</>;
}
