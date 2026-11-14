import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
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
  it("shows the navigation of every work package, in French by default", () => {
    renderAt("/alerts");

    for (const label of ["Aéronefs", "Tableau de bord", "Alertes", "Règles", "Comptes", "Connexion"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the current page", () => {
    renderAt("/alerts");

    expect(screen.getByRole("heading", { name: "Page content" })).toBeInTheDocument();
  });

  it("marks the link of the current page", () => {
    renderAt("/alerts");

    expect(screen.getByRole("link", { name: "Alertes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Règles" })).not.toHaveAttribute("aria-current");
  });

  it("switches the navigation to English", () => {
    renderAt("/alerts");

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("link", { name: "Aircraft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the theme", () => {
    renderAt("/alerts");

    fireEvent.click(screen.getByRole("button", { name: "Passer au thème clair" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Passer au thème sombre" })).toBeInTheDocument();
  });

  it("opens and closes the menu of the phone layout", () => {
    renderAt("/alerts");
    const menu = screen.getByRole("button", { name: "Ouvrir le menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menu);

    expect(screen.getByRole("button", { name: "Fermer le menu" })).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the menu when a link is followed", () => {
    renderAt("/alerts");
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));

    fireEvent.click(screen.getByRole("link", { name: "Alertes" }));

    expect(screen.getByRole("button", { name: "Ouvrir le menu" })).toBeInTheDocument();
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

  it("offers to log in to a visitor, and to log out to a logged in user", () => {
    renderAt("/alerts");
    expect(screen.getByRole("link", { name: "Connexion" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Se déconnecter" })).not.toBeInTheDocument();
  });

  it("logs the user out and goes back to the home page", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderAt("/alerts", fakeSession("authenticated", "USER", { logout }));
    expect(screen.queryByRole("link", { name: "Connexion" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Landing" })).toBeInTheDocument();
  });

  it("welcomes a new account once, then lets the visitor close the notice", async () => {
    renderAt({ pathname: "/alerts", state: { welcome: true } }, fakeSession("authenticated", "USER"));

    expect(await screen.findByRole("status")).toHaveTextContent("Bienvenue sur AeroSafe");
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not welcome again once the mark has been removed from the history", async () => {
    renderAt({ pathname: "/alerts", state: { welcome: true } }, fakeSession("authenticated", "USER"));
    await screen.findByRole("status");

    fireEvent.click(screen.getByRole("link", { name: "Règles" }));
    fireEvent.click(screen.getByRole("link", { name: "Alertes" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
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
