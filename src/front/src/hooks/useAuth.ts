import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";

/** The session of the visitor and the ways to open and close it. Must be used under `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used under AuthProvider");
  }
  return auth;
}
