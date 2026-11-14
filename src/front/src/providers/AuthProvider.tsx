import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { ApiClient } from "@/services/ApiClient";
import { AuthService } from "@/services/AuthService";

export interface AuthProviderProps {
  children: ReactNode;
  /** Where the session comes from. Tests give their own. */
  service?: AuthService;
}

/**
 * Gives the session to the whole application, and plugs it into the API client: the access
 * token goes with every request, and a 401 renews the session before the request is retried.
 */
export default function AuthProvider({ children, service }: AuthProviderProps) {
  // Done while the provider is created, not in an effect: the effects of the pages under it
  // run first, and their requests need the token provider already.
  const [auth] = useState(() => {
    const created = service ?? new AuthService();
    ApiClient.setTokenProvider(() => created.token());
    ApiClient.setSessionRenewer(() => created.renew());
    return created;
  });
  const session = useSyncExternalStore(auth.subscribe, auth.snapshot);

  useEffect(() => {
    void auth.restore();
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session.status === "unknown" ? "loading" : session.status,
      user: session.user,
      login: (email, password) => auth.login(email, password),
      signUp: (email, password) => auth.signUp(email, password),
      logout: () => auth.logout(),
    }),
    [auth, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
