import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Observation } from "@/models/Aircraft";
import { Flight, FlightDetail as Detail, FlightStatistics, TrajectoryGap } from "@/models/Flight";
import { memoryStore } from "@/pages/aircraft/testStore";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";
import { MapService } from "@/services/MapService";

import FlightDetail from "./FlightDetail";

const T0 = Date.parse("2026-11-09T10:00:00Z");
const ID = "01JC0000000000000000000F01";
const SUMMARY = new Flight(ID, "01JC0000000000000000000001", "3c6444", "D-AIBD", "DLH4AB", new Date(T0), null, "Frankfurt", null);
const STATS = new FlightStatistics(3, 960, 22.24, 10000, 11000, 230, 240);

function at(seconds: number, altitude: number | null): Observation {
  return new Observation(new Date(T0 + seconds * 1000), null, 48 + seconds / 10000, 2, altitude, 230, 0, false, ID);
}

function renderFlight(flight: AircraftService["flight"], language: "en" | "fr" = "en") {
  const service = { flight: vi.fn(flight) } as unknown as AircraftService;
  render(
    <PreferencesProvider store={memoryStore(language)}>
      <MemoryRouter initialEntries={[`/flights/${ID}`]}>
        <Routes>
          <Route path="/flights/:flightId" element={<FlightDetail service={service} />} />
        </Routes>
      </MemoryRouter>
    </PreferencesProvider>,
  );
  return service.flight as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FlightDetail", () => {
  it("shows its title while loading", () => {
    renderFlight(() => new Promise(() => {}));

    expect(screen.getByRole("heading", { name: "Flight" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("draws the trajectory and shows the statistics and profiles", async () => {
    const showSegments = vi.spyOn(MapService.prototype, "showSegments");
    const flight = renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 10000), at(60, 11000)], [], STATS));

    expect(await screen.findByRole("heading", { name: "DLH4AB" })).toBeInTheDocument();
    expect(flight).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("link", { name: "D-AIBD" })).toHaveAttribute("href", "/aircraft/01JC0000000000000000000001");
    expect(screen.getByText("16 min 00 s")).toBeInTheDocument();
    expect(screen.getByText("22.2 km")).toBeInTheDocument();
    expect(screen.getByText("11000 m")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Altitude profile" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Speed profile" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The map draws in an effect that can run after the title shows, so wait for it.
    await waitFor(() => expect(showSegments.mock.lastCall?.[0]).toHaveLength(1));
  });

  it("flags a partial trajectory and does not join its gaps", async () => {
    const showSegments = vi.spyOn(MapService.prototype, "showSegments");
    const gap = new TrajectoryGap(new Date(T0 + 30_000), new Date(T0 + 930_000), 900);
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 9000), at(930, 9000)], [gap], STATS));

    expect(await screen.findByRole("alert")).toHaveTextContent("1 missing segment,");
    expect(screen.getByText(/15 min 00 s/)).toBeInTheDocument();
    expect(showSegments.mock.lastCall?.[0]).toHaveLength(2);
  });

  it("says when the flight has no position or too few values for a profile", async () => {
    const blind = new Observation(new Date(T0), null, null, null, null, null, null, false, ID);
    renderFlight(async () => new Detail(SUMMARY, [blind], [], new FlightStatistics(1, 0, 0, null, null, null, null)));

    expect(await screen.findByText("No position recorded for this flight.")).toBeInTheDocument();
    expect(screen.getAllByText("Not enough values to draw a profile.")).toHaveLength(2);
  });

  it("is in French by default", async () => {
    const gap = new TrajectoryGap(new Date(T0 + 30_000), new Date(T0 + 930_000), 900);
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 9000), at(930, 9000)], [gap], STATS), "fr");

    expect(await screen.findByRole("alert")).toHaveTextContent("1 segment manquant");
    expect(screen.getByRole("heading", { name: "Statistiques" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Profil : Altitude" })).toBeInTheDocument();
  });

  it("says when the flight does not exist", async () => {
    renderFlight(async () => {
      throw new ApiError(404);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("This flight does not exist.");
  });

  it("says the flight does not exist when its identifier is not valid", async () => {
    renderFlight(async () => {
      throw new ApiError(422);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("This flight does not exist.");
  });
});
