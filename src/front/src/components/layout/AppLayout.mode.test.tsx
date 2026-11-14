import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/providers/AuthContext";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";
import { fakeSession } from "@/test/auth";

import AppLayout from "./AppLayout";

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

const mounted = vi.fn();

function Page() {
  useEffect(() => {
    mounted();
  }, []);
  return <h1>Page content</h1>;
}

function renderLayout(store = memoryStore(), path = "/alerts") {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Page /> },
          { path: "/alerts", element: <Page /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <PreferencesProvider store={store}>
      <AuthContext.Provider value={fakeSession("anonymous")}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </PreferencesProvider>,
  );
}

beforeEach(() => {
  mounted.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(CLOCK) }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  DataModeService.reset();
});

describe("AppLayout data mode", () => {
  it("shows the live data until the replay is chosen", () => {
    renderLayout();

    expect(screen.getByRole("button", { name: "Direct" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Rejeu" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("region", { name: "Rejeu du trafic historique" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the replay bar and reads the clock once the replay is chosen", async () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Rejeu" }));

    expect(screen.getByRole("button", { name: "Rejeu" })).toHaveAttribute("aria-pressed", "true");
    const bar = await screen.findByRole("region", { name: "Rejeu du trafic historique" });
    await waitFor(() => expect(bar).toHaveTextContent("Instant simulé"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/replay"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("goes back to the live data and hides the bar", async () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: "Rejeu" }));
    await screen.findByRole("region", { name: "Rejeu du trafic historique" });

    fireEvent.click(screen.getByRole("button", { name: "Direct" }));

    expect(screen.queryByRole("region", { name: "Rejeu du trafic historique" })).not.toBeInTheDocument();
  });

  it("loads the page again when the mode changes, so it shows the data of the new mode", () => {
    renderLayout();
    expect(mounted).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Rejeu" }));
    expect(mounted).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Direct" }));
    expect(mounted).toHaveBeenCalledTimes(3);
  });

  it("does not load the page again when the mode is chosen a second time", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Direct" }));

    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("names the switch in English", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("group", { name: "Data source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay" })).toBeInTheDocument();
  });

  it("remembers the replay for the next visit", () => {
    const store = memoryStore();
    renderLayout(store);

    fireEvent.click(screen.getByRole("button", { name: "Rejeu" }));

    expect(store.get(DataModeService.KEY)).toBe("replay");
  });

  it("floats the top bar over the landing page, but keeps it in the flow in the replay so the replay bar is not covered", async () => {
    renderLayout(memoryStore(), "/");
    expect(screen.getByRole("banner").className).toMatch(/overlay/);

    fireEvent.click(screen.getByRole("button", { name: "Rejeu" }));
    await screen.findByRole("region", { name: "Rejeu du trafic historique" });

    expect(screen.getByRole("banner").className).not.toMatch(/overlay/);
  });
});
