import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { type HomeOverview, type HomeOverviewService } from "@/services/HomeOverviewService";
import { PreferenceStore } from "@/services/PreferenceStore";

import HomeLive, { REFRESH_MS } from "./HomeLive";

const PLANES = [
  new Aircraft("1", "3944ee", "F-HBAB", null, null, null, 48.8, 2.3),
  new Aircraft("2", "3944ef", null, null, null, null, 48.9, 2.4),
];

const READY: HomeOverview = {
  aircraft: { state: "ready", data: PLANES },
  activeAlerts: { state: "ready", data: 3 },
  dayAlerts: { state: "ready", data: 12 },
};

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function fakeService(...overviews: HomeOverview[]) {
  const load = vi.fn<() => Promise<HomeOverview>>();
  overviews.forEach((overview, index) => {
    if (index === overviews.length - 1) load.mockResolvedValue(overview);
    else load.mockResolvedValueOnce(overview);
  });
  return { service: { load } as unknown as HomeOverviewService, load };
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider store={memoryStore()}>
      <MemoryRouter>{children}</MemoryRouter>
    </PreferencesProvider>
  );
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("HomeLive", () => {
  it("shows a loading message first", () => {
    vi.useFakeTimers();
    const { service } = fakeService(READY);

    render(<HomeLive service={service} />, { wrapper: Wrapper });

    expect(screen.getByRole("status")).toHaveTextContent("Chargement des données…");
  });

  it("shows the figures and the map once loaded", async () => {
    vi.useFakeTimers();
    const { service } = fakeService(READY);

    render(<HomeLive service={service} />, { wrapper: Wrapper });
    await settle();

    expect(screen.getByText("Aéronefs suivis").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Alertes actives").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Alertes (24 h)").nextSibling).toHaveTextContent("12");
    expect(screen.getByRole("img", { name: "Map of 2 aircraft" })).toBeInTheDocument();
  });

  it("invites a visitor who is not logged in to log in, and stops asking", async () => {
    vi.useFakeTimers();
    const { service, load } = fakeService({ ...READY, aircraft: { state: "unauthenticated" } });

    render(<HomeLive service={service} />, { wrapper: Wrapper });
    await settle();
    await settle(REFRESH_MS * 2);

    expect(screen.getByText("Connectez-vous pour voir le trafic en direct.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("hides the alert figures from a user who is not a Supervisor", async () => {
    vi.useFakeTimers();
    const { service } = fakeService({
      ...READY,
      activeAlerts: { state: "forbidden" },
      dayAlerts: { state: "forbidden" },
    });

    render(<HomeLive service={service} />, { wrapper: Wrapper });
    await settle();

    expect(screen.getByText("Aéronefs suivis")).toBeInTheDocument();
    expect(screen.queryByText("Alertes actives")).not.toBeInTheDocument();
    expect(screen.queryByText("Alertes (24 h)")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when a part could not be loaded and shows the rest", async () => {
    vi.useFakeTimers();
    const { service } = fakeService({ ...READY, dayAlerts: { state: "failed" } });

    render(<HomeLive service={service} />, { wrapper: Wrapper });
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("Certaines données n'ont pas pu être chargées");
    expect(screen.getByText("Alertes actives")).toBeInTheDocument();
    expect(screen.queryByText("Alertes (24 h)")).not.toBeInTheDocument();
  });

  it("refreshes every 30 seconds", async () => {
    vi.useFakeTimers();
    const { service, load } = fakeService(READY, {
      ...READY,
      activeAlerts: { state: "ready", data: 9 },
    });

    render(<HomeLive service={service} />, { wrapper: Wrapper });
    await settle();
    await settle(REFRESH_MS);

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Alertes actives").nextSibling).toHaveTextContent("9");
  });

  it("stops refreshing once removed", async () => {
    vi.useFakeTimers();
    const { service, load } = fakeService(READY);

    const { unmount } = render(<HomeLive service={service} />, { wrapper: Wrapper });
    await settle();
    unmount();
    await settle(REFRESH_MS * 3);

    expect(load).toHaveBeenCalledTimes(1);
  });
});
