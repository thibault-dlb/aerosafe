import { User } from "@/models/User";
import type { AuthContextValue, AuthStatus } from "@/providers/AuthContext";

const unused = async () => {
  throw new Error("not used by this test");
};

/** A session for the tests of the pages: logged in with `role`, or not logged in. */
export function fakeSession(status: AuthStatus, role?: string, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const user = role ? new User("01HZ", "jane.doe@example.fr", role, true) : null;
  return { status, user, login: unused, signUp: unused, logout: async () => undefined, ...overrides };
}
