import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";
import { fakeSession } from "@/test/auth";

import AppLayout from "./AppLayout";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function renderAt(path: string | { pathname: string; state: unknown }, session: AuthContextValue = fakeSession("anonymous")) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <h1>Landing</h1> },
          { path: "/alerts", element: <h1>Page content</h1> },
          { path: "/rules", element: <h1>Rules content</h1> },
          { path: "/login", element: <h1>Log in</h1> },
          { path: "/signup", element: <h1>Sign up</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <PreferencesProvider store={memoryStore()}>
      <AuthContext.Provider value={session}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </PreferencesProvider>,
  );
}

describe("AppLayout", () => {
  afterEach(() => {
    // The data mode is kept in memory too: it must not leak into the next case.
    DataModeService.reset();
  });

  it("offers the way in to a visitor, and no page of the application, in French by default", () => {
    renderAt("/alerts");

    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute("href", "/login");
    for (const label of ["Aéronefs", "Tableau de bord", "Alertes", "Règles", "Comptes"]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("shows the current page", () => {
    renderAt("/alerts");

    expect(screen.getByRole("heading", { name: "Page content" })).toBeInTheDocument();
  });

  it("switches the interface to English", () => {
    renderAt("/alerts");

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the theme", () => {
    renderAt("/alerts");

    fireEvent.click(screen.getByRole("button", { name: "Passer au thème clair" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Passer au thème sombre" })).toBeInTheDocument();
  });

  it("offers to skip the navigation and shows the disclaimer", () => {
    renderAt("/alerts");

    expect(screen.getByRole("link", { name: "Aller au contenu" })).toHaveAttribute("href", "#content");
    expect(within(screen.getByRole("contentinfo")).getByText(/projet pédagogique/)).toBeInTheDocument();
  });

  it.each(["/", "/alerts"])("does not show the educational notice on %s", (path) => {
    renderAt(path);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a logged in user to open the application instead of logging in", () => {
    renderAt("/", fakeSession("authenticated", "USER"));

    expect(screen.queryByRole("link", { name: "Connexion" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir l'application" })).toHaveAttribute("href", "/dashboard");
  });

  it("lets the visitor choose the data source", () => {
    renderAt("/");

    expect(screen.getByRole("button", { name: "Direct" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Rejeu" }));
    expect(screen.getByRole("button", { name: "Rejeu" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the landing page in the dark theme, and only that page", () => {
    renderAt("/");
    expect(document.querySelector(".darkScope")).not.toBeNull();
  });

  it("leaves the other pages in the theme of the visitor", () => {
    renderAt("/alerts");
    expect(document.querySelector(".darkScope")).toBeNull();
  });

  it("makes the bar solid once the landing page has scrolled", () => {
    renderAt("/");
    const bar = screen.getByRole("banner");
    expect(bar.className).not.toMatch(/barSolid/);

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 300, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });

    expect(bar.className).toMatch(/barSolid/);
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});
