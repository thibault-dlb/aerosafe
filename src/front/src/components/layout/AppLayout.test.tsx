import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

import AppLayout from "./AppLayout";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <h1>Landing</h1> },
          { path: "/alerts", element: <h1>Page content</h1> },
          { path: "/login", element: <h1>Log in</h1> },
          { path: "/signup", element: <h1>Sign up</h1> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <PreferencesProvider store={memoryStore()}>
      <RouterProvider router={router} />
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

  it.each(["/login", "/signup"])("shows the educational notice on %s", (path) => {
    renderAt(path);

    expect(screen.getByRole("status")).toHaveTextContent("Projet pédagogique");
  });

  it.each(["/", "/alerts"])("does not show the educational notice on %s", (path) => {
    renderAt(path);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
