import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthContext, type AuthContextValue, type AuthStatus } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";
import { User } from "@/models/User";

import RequireAuth from "./RequireAuth";
import RequireRole from "./RequireRole";

const NOBODY = async () => {
  throw new Error("not used");
};

function session(status: AuthStatus, role?: string): AuthContextValue {
  const user = role ? new User("01HZ", "jane@example.fr", role, true) : null;
  return { status, user, login: NOBODY, signUp: NOBODY, logout: NOBODY };
}

function LogIn() {
  const location = useLocation();
  return <p>log in screen, from {JSON.stringify(location.state)}</p>;
}

function renderAt(path: string, value: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LogIn /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/dashboard", element: <h1>Dashboard</h1> },
          {
            element: <RequireRole role="SUPERVISOR" />,
            children: [{ path: "/rules", element: <h1>Rules</h1> }],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <PreferencesProvider store={new PreferenceStore(null)}>
      <AuthContext.Provider value={value}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </PreferencesProvider>,
  );
}

describe("RequireAuth", () => {
  it("shows the page to a logged in visitor", () => {
    renderAt("/dashboard", session("authenticated", "USER"));

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("waits for the session before choosing", () => {
    renderAt("/dashboard", session("loading"));

    expect(screen.getByRole("status")).toHaveTextContent("Ouverture de la session");
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("sends an anonymous visitor to the log in screen, keeping the page that was asked for", () => {
    renderAt("/dashboard?tab=map#top", session("anonymous"));

    expect(screen.getByText(/log in screen/)).toHaveTextContent('{"from":"/dashboard?tab=map#top"}');
  });
});

describe("RequireRole", () => {
  it("shows the page to a Supervisor", () => {
    renderAt("/rules", session("authenticated", "SUPERVISOR"));

    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
  });

  it("shows the access denied page to a User", () => {
    renderAt("/rules", session("authenticated", "USER"));

    expect(screen.getByRole("heading", { name: "Accès réservé" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("heading", { name: "Rules" })).not.toBeInTheDocument();
  });
});
