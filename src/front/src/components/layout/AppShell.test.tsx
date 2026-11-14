import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, type InitialEntry, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
import type { AlertService } from "@/services/AlertService";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";
import { SidebarPreference } from "@/services/SidebarPreference";
import { fakeSession } from "@/test/auth";

import AppShell from "./AppShell";

const CLOCK = {
  available: true,
  start: "2022-08-01T00:00:00Z",
  end: "2022-08-31T23:59:59Z",
  simulated_at: "2022-08-14T15:00:00Z",
  speed: 10,
  paused: false,
  finished: false,
  server_time: "2026-11-13T10:00:00Z",
  allowed_speeds: [1, 10, 60],
};

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function stubAlerts(total = 3) {
  return { search: vi.fn().mockResolvedValue({ total }) } as unknown as AlertService & {
    search: ReturnType<typeof vi.fn>;
  };
}

function stubPhone() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

interface Options {
  session?: AuthContextValue;
  path?: InitialEntry;
  alerts?: AlertService;
  preferences?: SidebarPreference;
}

function renderShell({
  session = fakeSession("authenticated", "SUPERVISOR"),
  path = "/alerts",
  alerts = stubAlerts(),
  preferences = new SidebarPreference(memoryStore()),
}: Options = {}) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <h1>Landing</h1> },
      {
        element: <AppShell preferences={preferences} alerts={alerts} />,
        children: [
          { path: "/dashboard", element: <h1>Dashboard page</h1> },
          { path: "/aircraft", element: <h1>Aircraft page</h1> },
          { path: "/aircraft/:id", element: <h1>Record page</h1> },
          { path: "/flights/:id", element: <h1>Flight page</h1> },
          { path: "/alerts", element: <h1>Alerts page</h1> },
          { path: "/rules", element: <h1>Rules page</h1> },
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
  return router;
}

const menu = () => screen.getByRole("navigation", { name: "Navigation principale" });

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(CLOCK) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    DataModeService.reset();
  });

  it("shows the page inside the frame, with the skip link and the disclaimer", () => {
    renderShell();

    expect(screen.getByRole("heading", { name: "Alerts page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aller au contenu" })).toHaveAttribute("href", "#content");
    expect(within(screen.getByRole("contentinfo")).getByText(/projet pédagogique/)).toBeInTheDocument();
  });

  it("gives a User the dashboard and the aircraft, and nothing of the supervision", () => {
    const alerts = stubAlerts();
    renderShell({ session: fakeSession("authenticated", "USER"), path: "/dashboard", alerts });

    expect(within(menu()).getAllByRole("link").map((link) => link.textContent)).toEqual(["Tableau de bord", "Aéronefs"]);
    expect(screen.queryByText("Supervision")).not.toBeInTheDocument();
    expect(alerts.search).not.toHaveBeenCalled();
  });

  it("gives a Supervisor the supervision pages too, with the number of active alerts", async () => {
    renderShell();

    expect(screen.getByText("Supervision")).toBeInTheDocument();
    for (const name of [/Tableau de bord/, /Aéronefs/, /Alertes/, /Règles/, /Comptes/]) {
      expect(within(menu()).getByRole("link", { name })).toBeInTheDocument();
    }
    await waitFor(() => expect(within(menu()).getByRole("link", { name: /Alertes/ })).toHaveTextContent("3 actives"));
  });

  it("shows no badge when there is no active alert", async () => {
    const alerts = stubAlerts(0);
    renderShell({ alerts });

    await waitFor(() => expect(alerts.search).toHaveBeenCalled());

    expect(within(menu()).getByRole("link", { name: "Alertes" })).toBeInTheDocument();
  });

  it("shows who is logged in, with the role", () => {
    renderShell();

    const account = screen.getByRole("group", { name: "Compte" });
    expect(account).toHaveTextContent("jane.doe@example.fr");
    expect(account).toHaveTextContent("Superviseur");
    expect(account).toHaveTextContent("JD");
  });

  it("marks the page that is open, and names it in the top bar", () => {
    renderShell({ path: "/rules" });

    expect(within(menu()).getByRole("link", { name: "Règles" })).toHaveAttribute("aria-current", "page");
    expect(within(menu()).getByRole("link", { name: /Alertes/ })).not.toHaveAttribute("aria-current");
    expect(within(screen.getByRole("banner")).getByText("Règles")).toBeInTheDocument();
  });

  it.each(["/aircraft/01HZ", "/flights/01HZ"])("keeps %s in the aircraft section", (path) => {
    renderShell({ path });

    expect(within(menu()).getByRole("link", { name: "Aéronefs" })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("banner")).getByText("Aéronefs")).toBeInTheDocument();
  });

  it("folds into a rail of icons, and remembers it", () => {
    const preferences = new SidebarPreference(memoryStore());
    renderShell({ preferences });
    const fold = screen.getByRole("button", { name: "Replier la barre" });
    expect(fold).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(fold);

    expect(screen.getByRole("button", { name: "Déplier la barre" })).toHaveAttribute("aria-expanded", "false");
    expect(within(menu()).getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("title", "Tableau de bord");
    expect(preferences.isFolded()).toBe(true);
  });

  it("opens folded when the visitor left it folded", () => {
    const preferences = new SidebarPreference(memoryStore());
    preferences.setFolded(true);

    renderShell({ preferences });

    expect(screen.getByRole("button", { name: "Déplier la barre" })).toBeInTheDocument();
  });

  it("logs the user out and goes back to the home page", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderShell({ session: fakeSession("authenticated", "SUPERVISOR", { logout }) });

    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Landing" })).toBeInTheDocument();
  });

  it("shows the language, the theme and the data source in the top bar", () => {
    renderShell();
    const bar = within(screen.getByRole("banner"));

    expect(bar.getByRole("group", { name: "Source des données" })).toBeInTheDocument();
    expect(bar.getByRole("group", { name: "Langue" })).toBeInTheDocument();
    fireEvent.click(bar.getByRole("button", { name: "Passer au thème clair" }));
    expect(bar.getByRole("button", { name: "Passer au thème sombre" })).toBeInTheDocument();
  });

  it("shows the replay bar once the visitor chooses the replay", async () => {
    renderShell();
    expect(screen.queryByRole("region", { name: "Rejeu du trafic historique" })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Rejeu" }));

    expect(await screen.findByRole("region", { name: "Rejeu du trafic historique" })).toBeInTheDocument();
  });

  it("welcomes a new account once, then lets the visitor close the notice", async () => {
    renderShell({ path: { pathname: "/dashboard", state: { welcome: true } } });

    expect(await screen.findByRole("status")).toHaveTextContent("Bienvenue sur AeroSafe");
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("removes the welcome mark from the history, so a reload does not welcome again", async () => {
    const router = renderShell({ path: { pathname: "/dashboard", state: { welcome: true } } });

    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  it("does not welcome anyone after a plain log in", () => {
    renderShell({ path: "/dashboard" });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows nothing without a logged in user", () => {
    renderShell({ session: fakeSession("authenticated") });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  describe("on a phone", () => {
    beforeEach(stubPhone);

    it("keeps the menu closed and out of reach until the menu button is used", () => {
      renderShell({ session: fakeSession("authenticated", "USER"), path: "/dashboard" });

      expect(screen.queryByRole("link", { name: "Aéronefs" })).not.toBeInTheDocument();
      const button = screen.getByRole("button", { name: "Ouvrir le menu" });
      expect(button).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(button);

      expect(screen.getByRole("link", { name: "Aéronefs" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Fermer le menu" })).toHaveAttribute("aria-expanded", "true");
    });

    it("cannot be folded: it is a drawer", () => {
      renderShell();
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));

      expect(screen.queryByRole("button", { name: /Replier la barre|Déplier la barre/ })).not.toBeInTheDocument();
    });

    it("closes with the Escape key", () => {
      renderShell();
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.getByRole("button", { name: "Ouvrir le menu" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Aéronefs" })).not.toBeInTheDocument();
    });

    it("ignores the other keys", () => {
      renderShell();
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));

      fireEvent.keyDown(window, { key: "a" });

      expect(screen.getByRole("link", { name: "Aéronefs" })).toBeInTheDocument();
    });

    it("closes when the backdrop is touched, and when a page is chosen", async () => {
      const router = renderShell();
      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));
      fireEvent.click(document.querySelector("[class*='backdrop']") as Element);
      expect(screen.queryByRole("link", { name: "Aéronefs" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu" }));
      fireEvent.click(screen.getByRole("link", { name: "Aéronefs" }));

      await waitFor(() => expect(router.state.location.pathname).toBe("/aircraft"));
      expect(screen.getByRole("button", { name: "Ouvrir le menu" })).toBeInTheDocument();
    });
  });
});
