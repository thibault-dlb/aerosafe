import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReplayState, type ReplayStateJson } from "@/models/ReplayState";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { ReplayContext, type ReplayContextValue } from "@/providers/ReplayContext";
import { PreferenceStore } from "@/services/PreferenceStore";

import ReplayBar from "./ReplayBar";

function json(changes: Partial<ReplayStateJson> = {}): ReplayStateJson {
  return {
    available: true,
    start: "2022-08-01T00:00:00Z",
    end: "2022-08-31T23:59:59Z",
    simulated_at: "2022-08-14T15:00:00Z",
    speed: 10,
    paused: false,
    finished: false,
    server_time: "2026-11-13T10:00:00Z",
    allowed_speeds: [1, 10, 60],
    ...changes,
  };
}

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function context(changes: Partial<ReplayContextValue> = {}): ReplayContextValue {
  const state = ReplayState.fromJson(json());
  return {
    state,
    now: state.simulatedAt,
    loading: false,
    problem: null,
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    setSpeed: vi.fn().mockResolvedValue(undefined),
    ...changes,
  };
}

function renderBar(value: ReplayContextValue | null) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PreferencesProvider store={memoryStore()}>
        <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>
      </PreferencesProvider>
    );
  }
  return render(<ReplayBar />, { wrapper: Wrapper });
}

function bar() {
  return screen.getByRole("region", { name: "Rejeu du trafic historique" });
}

describe("ReplayBar", () => {
  it("shows nothing outside the replay provider", () => {
    renderBar(null);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("says it is loading the clock", () => {
    renderBar(context({ state: null, now: null, loading: true }));

    expect(within(bar()).getByRole("status")).toHaveTextContent("Chargement de l'horloge de rejeu…");
  });

  it("says why there is no clock", () => {
    renderBar(context({ state: null, now: null, problem: "failed" }));

    expect(within(bar()).getByRole("alert")).toHaveTextContent("L'horloge de rejeu est injoignable");
  });

  it("says when no replay data is imported", () => {
    const state = ReplayState.fromJson(
      json({ available: false, start: null, end: null, simulated_at: null }),
    );

    renderBar(context({ state, now: null }));

    expect(within(bar()).getByRole("status")).toHaveTextContent("Aucune donnée de rejeu");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the simulated time in UTC", () => {
    renderBar(context());

    const time = within(bar()).getByText(/15:00:00 UTC/);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", "2022-08-14T15:00:00.000Z");
  });

  it("tells that the replay has not started, and offers to start it", () => {
    const state = ReplayState.fromJson(json({ simulated_at: null, paused: true }));

    renderBar(context({ state, now: null }));

    expect(within(bar()).getByText(/Le rejeu n'a pas démarré/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Démarrer" })).toBeInTheDocument();
  });

  it("shows the period that can be replayed", () => {
    renderBar(context());

    expect(within(bar()).getByText(/Période disponible : 01\/08\/2022 00:00 → 31\/08\/2022 23:59/)).toBeInTheDocument();
  });

  it("pauses a running clock", () => {
    const value = context();
    renderBar(value);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(value.pause).toHaveBeenCalledTimes(1);
  });

  it("resumes a paused clock", () => {
    const state = ReplayState.fromJson(json({ paused: true }));
    const value = context({ state });
    renderBar(value);

    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }));

    expect(value.resume).toHaveBeenCalledTimes(1);
  });

  it("shows the speed in use and changes it", () => {
    const value = context();
    renderBar(value);
    const speeds = within(screen.getByRole("group", { name: "Vitesse" }));

    expect(speeds.getByRole("button", { name: "×10" })).toHaveAttribute("aria-pressed", "true");
    expect(speeds.getByRole("button", { name: "×60" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(speeds.getByRole("button", { name: "×60" }));

    expect(value.setSpeed).toHaveBeenCalledWith(60);
  });

  it("stops the controls of the clock at the end of the data", () => {
    const state = ReplayState.fromJson(
      json({ simulated_at: "2022-08-31T23:59:59Z", finished: true, paused: true }),
    );

    renderBar(context({ state }));

    expect(screen.getByRole("button", { name: "Reprendre" })).toBeDisabled();
    expect(within(bar()).getByText("Fin des données atteinte : le rejeu est arrêté.")).toBeInTheDocument();
  });

  it("starts at the instant chosen, read as UTC, at the speed in use", () => {
    const value = context();
    renderBar(value);

    fireEvent.change(screen.getByLabelText("Démarrer à (UTC)"), {
      target: { value: "2022-08-20T08:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));

    expect(value.start).toHaveBeenCalledWith(new Date("2022-08-20T08:30:00Z"), 10);
  });

  it("proposes the start of the data until another instant is chosen", () => {
    const value = context();
    renderBar(value);

    expect(screen.getByLabelText("Démarrer à (UTC)")).toHaveValue("2022-08-01T00:00");
    fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));

    expect(value.start).toHaveBeenCalledWith(new Date("2022-08-01T00:00:00Z"), 10);
  });

  it("limits the choice of the instant to the period of the data", () => {
    renderBar(context());

    const field = screen.getByLabelText("Démarrer à (UTC)");
    expect(field).toHaveAttribute("min", "2022-08-01T00:00");
    expect(field).toHaveAttribute("max", "2022-08-31T23:59");
  });

  it("falls back to the start of the data when the field is emptied", () => {
    const value = context();
    renderBar(value);

    fireEvent.change(screen.getByLabelText("Démarrer à (UTC)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Démarrer" }));

    expect(value.start).toHaveBeenCalledWith(new Date("2022-08-01T00:00:00Z"), 10);
  });

  it("says that only a supervisor can drive the replay", () => {
    renderBar(context({ problem: "forbidden" }));

    expect(within(bar()).getByRole("alert")).toHaveTextContent("Seul un superviseur peut piloter le rejeu.");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });
});
