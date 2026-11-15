import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import { Alert } from "@/models/Alert";
import type { TrackedSnapshot } from "@/models/Traffic";
import { renderInApp } from "@/test/app";

import TrackedAircraft, { CARD_REFRESH_MS } from "./TrackedAircraft";

const NOW = new Date("2026-11-14T10:00:00Z");
const AIRCRAFT = new Aircraft("01A", "3c6444", "F-GKXA", "Airbus A320", "Air France", NOW, 48.8, 2.3);
const ALERT = new Alert("01X", "R3", NOW, "m", "01A", "3c6444", null, "Vitesse", 400, 300, "m/s", "HIGH");
const HISTORY = [
  { at: 0, lat: 48.7, lon: 2.1, altitude: 3000 },
  { at: 600_000, lat: 48.8, lon: 2.3, altitude: 9000 },
];

function snapshot(overrides: Partial<TrackedSnapshot> = {}): TrackedSnapshot {
  return { id: "01A", lat: 48.8534, lon: 2.3488, altitude: 9000, heading: 7, speed: 230, onGround: false, age: 12_000, silent: false, ...overrides };
}

function card(overrides: Partial<React.ComponentProps<typeof TrackedAircraft>> = {}) {
  const props = {
    aircraft: AIRCRAFT,
    describe: vi.fn().mockReturnValue(snapshot()),
    alert: null,
    history: HISTORY,
    following: true,
    onFollow: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  renderInApp(<TrackedAircraft {...props} />);
  return props;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TrackedAircraft", () => {
  it("shows who the aircraft is and where it is, with its values in metric units", () => {
    card();

    expect(screen.getByRole("heading", { name: "F-GKXA" })).toBeInTheDocument();
    expect(screen.getByText("3C6444 · Airbus A320 · Air France")).toBeInTheDocument();
    expect(screen.getByText("9000 m")).toBeInTheDocument();
    expect(screen.getByText("828 km/h")).toBeInTheDocument();
    expect(screen.getByText("007°")).toBeInTheDocument();
    expect(screen.getByText("il y a 12 s")).toBeInTheDocument();
    expect(screen.getByText("48.8534° N 2.3488° E")).toBeInTheDocument();
  });

  it("shows the units of the user's choice", () => {
    renderInApp(<TrackedAircraft aircraft={AIRCRAFT} describe={() => snapshot()} alert={null} history={HISTORY} following onFollow={vi.fn()} onClose={vi.fn()} />, {
      preferences: { "aerosafe.units": "aeronautical" },
    });

    expect(screen.getByText("29528 ft")).toBeInTheDocument();
    expect(screen.getByText("447 kt")).toBeInTheDocument();
  });

  it("says an aircraft is on the ground, and that it is silent", () => {
    card({ describe: vi.fn().mockReturnValue(snapshot({ onGround: true, silent: true, age: 95_000, heading: null, speed: null })) });

    expect(screen.getByText("Au sol")).toBeInTheDocument();
    expect(screen.getByText("muet depuis 1 min 35 s")).toBeInTheDocument();
  });

  it("shows the active alert with its rule", () => {
    card({ alert: ALERT });

    expect(screen.getByText("R3")).toBeInTheDocument();
  });

  it("draws the profile of the altitude, or says there is not enough to draw", () => {
    const { unmount } = (() => {
      card();
      return { unmount: () => undefined };
    })();
    expect(screen.getByRole("img", { name: /Profil d'altitude du vol : 2 points/ })).toBeInTheDocument();
    unmount();
  });

  it("says when the flight is too short to draw", () => {
    card({ history: [] });

    expect(screen.getByText("Pas assez de points connus pour tracer le profil.")).toBeInTheDocument();
  });

  it("reads the map again twice a second", () => {
    const describe = vi.fn().mockReturnValue(snapshot());
    card({ describe });
    const before = describe.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(CARD_REFRESH_MS * 3);
    });

    expect(describe.mock.calls.length).toBe(before + 3);
  });

  it("shows nothing of the values when the map does not know the aircraft", () => {
    card({ describe: vi.fn().mockReturnValue(null) });

    expect(screen.queryByText("Altitude")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "F-GKXA" })).toBeInTheDocument();
  });

  it("links to the record, toggles the follow and closes", () => {
    const props = card({ following: false });

    expect(screen.getByRole("link", { name: "Ouvrir la fiche" })).toHaveAttribute("href", "/aircraft/01A");
    fireEvent.click(screen.getByRole("button", { name: "Suivre" }));
    fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" }));

    expect(props.onFollow).toHaveBeenCalledWith(true);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
