import { createContext } from "react";

import type { User } from "@/models/User";

/** `loading` lasts until the API has said whether a session is kept for this browser. */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  /** Creates the account and logs in. */
  signUp: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
