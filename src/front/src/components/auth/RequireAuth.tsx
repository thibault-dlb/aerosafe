import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import SessionLoading from "@/components/auth/SessionLoading";
import { useAuth } from "@/hooks/useAuth";
import { AuthRedirect } from "@/services/AuthRedirect";

export interface RequireAuthProps {
  /** What to protect. Without it, the child routes of the route this is the element of. */
  children?: ReactNode;
}

/** Lets a logged in visitor through; the others go to the log in screen and come back afterwards. */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <SessionLoading />;
  }
  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={AuthRedirect.state(from)} />;
  }
  return <>{children ?? <Outlet />}</>;
}
