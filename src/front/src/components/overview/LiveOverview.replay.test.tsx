import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { ReplayContext, type ReplayContextValue } from "@/providers/ReplayContext";
import { DataModeService } from "@/services/DataModeService";
import { type LiveOverviewData, type LiveOverviewService } from "@/services/LiveOverviewService";
import { PreferenceStore } from "@/services/PreferenceStore";

import LiveOverview, { REFRESH_MS, REPLAY_REFRESH_MS } from "./LiveOverview";

const READY: LiveOverviewData = {
  aircraft: { state: "ready", data: [new Aircraft("1", "000001", null, null, null, null, 46.5, 2.5)] },
  activeAlerts: { state: "ready", data: 4 },
  dayAlerts: { state: "ready", data: 9 },
};

function replayStore(): PreferenceStore {
  const values = new Map<string, string>();
  const store = new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
  new DataModeService(store).set("replay");
  return store;
}

function clock(now: Date | null): ReplayContextValue {
  return {
    state: null,
    now,
    loading: false,
    problem: null,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setSpeed: vi.fn(),
  };
}

function renderHome(now: Date | null, overview: LiveOverviewData = READY) {
  const load = vi.fn<() => Promise<LiveOverviewData>>().mockResolvedValue(overview);
  const service = { load } as unknown as LiveOverviewService;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PreferencesProvider store={replayStore()}>
        <ReplayContext.Provider value={clock(now)}>
          <MemoryRouter>{children}</MemoryRouter>
        </ReplayContext.Provider>
      </PreferencesProvider>
    );
  }
  render(<LiveOverview service={service} />, { wrapper: Wrapper });
  return load;
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
  DataModeService.reset();
});

describe("LiveOverview in the replay", () => {
  it("shows the simulated time and the replayed figures", async () => {
    vi.useFakeTimers();

    renderHome(new Date("2022-08-14T15:30:00Z"));
    await settle();

    expect(screen.getByRole("heading", { name: "Rejeu · 14/08/2022 15:30 UTC · France" })).toBeInTheDocument();
    expect(screen.getByText("Aéronefs suivis").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Alertes actives").nextSibling).toHaveTextContent("4");
  });

  it("says the replay has not started when the clock has no instant", async () => {
    vi.useFakeTimers();

    renderHome(null);
    await settle();

    expect(screen.getByRole("heading", { name: "Rejeu non démarré" })).toBeInTheDocument();
  });

  it("refreshes every 5 seconds, the traffic moves with the clock", async () => {
    vi.useFakeTimers();

    const load = renderHome(new Date("2022-08-14T15:30:00Z"));
    await settle();
    await settle(REPLAY_REFRESH_MS);

    expect(REPLAY_REFRESH_MS).toBeLessThan(REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("invites a visitor who is not logged in to log in to see the replay", async () => {
    vi.useFakeTimers();

    renderHome(null, { ...READY, aircraft: { state: "unauthenticated" } });
    await settle();

    expect(screen.getByText("Connectez-vous pour voir le rejeu du trafic.")).toBeInTheDocument();
  });
});
