import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";
import { fakeSession } from "@/test/auth";

import Forbidden from "./Forbidden";
import NotFound from "./NotFound";

function renderAt(path: string, session: AuthContextValue = fakeSession("anonymous")) {
  const router = createMemoryRouter(
    [
      { path: "/forbidden", element: <Forbidden /> },
      { path: "*", element: <NotFound /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <PreferencesProvider store={new PreferenceStore(null)}>
      <AuthContext.Provider value={session}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </PreferencesProvider>,
  );
}

describe("NotFound", () => {
  it("tells that no echo answers on this route, and shows the address as a callsign", () => {
    renderAt("/aircraft/f-inconnu");

    expect(screen.getByRole("heading", { level: 1, name: "Aucun écho sur cette route" })).toBeInTheDocument();
    expect(screen.getByText("R1 · Contact perdu")).toBeInTheDocument();
    expect(screen.getByText("/aircraft/f-inconnu")).toBeInTheDocument();
    expect(screen.getByText("Hors de portée")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Écran radar/ })).toBeInTheDocument();
  });

  it("cuts an address that is too long", () => {
    renderAt(`/${"a".repeat(100)}`);

    expect(screen.getByText(/^\/a+…$/).textContent?.length).toBeLessThan(70);
  });

  it("sends a visitor back to the home page", () => {
    renderAt("/nowhere");

    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Chercher un aéronef" })).toHaveAttribute("href", "/aircraft");
  });

  it("sends a logged in user back to the dashboard", () => {
    renderAt("/nowhere", fakeSession("authenticated", "USER"));

    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/dashboard");
  });
});

describe("Forbidden", () => {
  it("tells the page is reserved and leads back to the dashboard", () => {
    renderAt("/forbidden");

    expect(screen.getByRole("heading", { name: "Accès réservé" })).toBeInTheDocument();
    expect(screen.getByText("Cette page est réservée aux Superviseurs.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/dashboard");
  });
});
