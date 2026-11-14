import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import type { RoleCode } from "@/models/User";
import Forbidden from "@/pages/Forbidden";

export interface RequireRoleProps {
  role: RoleCode;
  /** What to protect. Without it, the child routes of the route this is the element of. */
  children?: ReactNode;
}

/** Shows the page to the roles allowed to see it, and the "access denied" page to the others. Goes under `RequireAuth`. */
export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user } = useAuth();

  if (!user?.can(role)) {
    return <Forbidden />;
  }
  return <>{children ?? <Outlet />}</>;
}
