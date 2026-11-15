import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Observation } from "@/models/Aircraft";
import { Flight, FlightDetail as Detail, FlightStatistics, TrajectoryGap } from "@/models/Flight";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";
import { MapService } from "@/services/MapService";
import { renderInApp } from "@/test/app";

import FlightDetail from "./FlightDetail";

const T0 = Date.parse("2026-11-09T10:00:00Z");
const ID = "01JC0000000000000000000F01";
const SUMMARY = new Flight(ID, "01JC0000000000000000000001", "3c6444", "D-AIBD", "DLH4AB", new Date(T0), null, "Frankfurt", null);
const ENDED = new Flight(ID, "01JC0000000000000000000001", "3c6444", null, null, new Date(T0), new Date(T0 + 3600_000), "Frankfurt", "Paris");
const STATS = new FlightStatistics(3, 960, 22.24, 10000, 11000, 230, 240);

function at(seconds: number, altitude: number | null, heading = 0): Observation {
  return new Observation(new Date(T0 + seconds * 1000), null, 48 + seconds / 10000, 2, altitude, 230, heading, false, ID);
}

function renderFlight(flight: AircraftService["flight"], preferences: Record<string, string> = {}) {
  const service = { flight: vi.fn(flight) } as unknown as AircraftService;
  renderInApp(
    <Routes>
      <Route path="/flights/:flightId" element={<FlightDetail service={service} />} />
    </Routes>,
    { path: `/flights/${ID}`, preferences },
  );
  return service.flight as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FlightDetail", () => {
  it("shows its title while loading", () => {
    renderFlight(() => new Promise(() => {}));

    expect(screen.getByRole("heading", { name: "Vol" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement");
  });

  it("is headed by the flight, with the way back to the aircraft and the figures of the flight", async () => {
    const flight = renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 10000), at(60, 11000)], [], STATS));

    expect(await screen.findByRole("heading", { level: 1, name: "DLH4AB" })).toBeInTheDocument();
    expect(flight).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("link", { name: "Aéronefs" })).toHaveAttribute("href", "/aircraft");
    for (const link of screen.getAllByRole("link", { name: "D-AIBD" })) {
      expect(link).toHaveAttribute("href", "/aircraft/01JC0000000000000000000001");
    }
    expect(screen.getByText("16 min 00 s")).toBeInTheDocument();
    expect(screen.getByText("22.2 km")).toBeInTheDocument();
    expect(screen.getByText("11000 m")).toBeInTheDocument();
    expect(screen.getByText("moyenne 10000 m")).toBeInTheDocument();
    expect(screen.getByText("moyenne 828 km/h")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("draws the trajectory, ending on the aircraft turned to its last heading", async () => {
    const showSegments = vi.spyOn(MapService.prototype, "showSegments");
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000, 10), at(30, 10000, 20), at(60, 11000, 30)], [], STATS));

    await screen.findByRole("heading", { level: 1, name: "DLH4AB" });

    // The map draws in an effect that can run after the title shows, so wait for it.
    await waitFor(() => expect(showSegments.mock.lastCall?.[0]).toHaveLength(1));
    await waitFor(() => expect(showAircraft.mock.lastCall?.[0][0]).toMatchObject({ heading: 30 }));
    expect(screen.getByRole("img", { name: "Profil : Altitude" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Profil : Vitesse" })).toBeInTheDocument();
  });

  it("shows the figures and the profiles in the unit system chosen", async () => {
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 10000), at(60, 11000)], [], STATS), {
      "aerosafe.units": "aeronautical",
    });

    await screen.findByRole("heading", { level: 1, name: "DLH4AB" });
    expect(screen.getByText("12.0 NM")).toBeInTheDocument();
    expect(screen.getByText("36089 ft")).toBeInTheDocument();
    expect(screen.getByText("467 kt")).toBeInTheDocument();
    expect(screen.getByText("Altitude (ft)")).toBeInTheDocument();
    expect(screen.getByText("Vitesse (kt)")).toBeInTheDocument();
  });

  it("tells the route, with the unknown destination of a flight in progress", async () => {
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 10000)], [], STATS));

    expect(await screen.findByText("Frankfurt", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("arrivée inconnue")).toBeInTheDocument();
  });

  it("tells the destination and the end of a flight that ended, and names it by its address", async () => {
    renderFlight(async () => new Detail(ENDED, [at(0, 9000), at(30, 10000)], [], STATS));

    expect(await screen.findByRole("heading", { level: 1, name: "3C6444" })).toBeInTheDocument();
    expect(screen.getByText("Paris", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("En cours")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "3C6444" }).length).toBeGreaterThan(0);
  });

  it("flags a partial trajectory and does not join its gaps", async () => {
    const showSegments = vi.spyOn(MapService.prototype, "showSegments");
    const gap = new TrajectoryGap(new Date(T0 + 30_000), new Date(T0 + 930_000), 900);
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 9000), at(930, 9000)], [gap], STATS));

    expect(await screen.findByRole("alert")).toHaveTextContent("1 segment manquant");
    expect(screen.getByText(/15 min 00 s\)/)).toBeInTheDocument();
    // The map draws in an effect that can run after the alert shows, so wait for it.
    await waitFor(() => expect(showSegments.mock.lastCall?.[0]).toHaveLength(2));
    expect(screen.getAllByText("sans données")).toHaveLength(2);
  });

  it("counts several missing segments", async () => {
    const gaps = [
      new TrajectoryGap(new Date(T0 + 30_000), new Date(T0 + 330_000), 300),
      new TrajectoryGap(new Date(T0 + 360_000), new Date(T0 + 930_000), 570),
    ];
    renderFlight(async () => new Detail(SUMMARY, [at(0, 9000), at(30, 9000), at(330, 9000), at(360, 9000), at(930, 9000)], gaps, STATS));

    expect(await screen.findByRole("alert")).toHaveTextContent("2 segments manquants");
  });

  it("says when the flight has no position or too few values for a profile", async () => {
    const blind = new Observation(new Date(T0), null, null, null, null, null, null, false, ID);
    renderFlight(async () => new Detail(SUMMARY, [blind], [], new FlightStatistics(1, 0, 0, null, null, null, null)));

    expect(await screen.findByText("Aucune position enregistrée pour ce vol.")).toBeInTheDocument();
    expect(screen.getAllByText("Pas assez de valeurs pour tracer un profil.")).toHaveLength(2);
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });

  it("says when the flight does not exist", async () => {
    renderFlight(async () => {
      throw new ApiError(404);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Ce vol n'existe pas.");
  });

  it("says the flight does not exist when its identifier is not valid", async () => {
    renderFlight(async () => {
      throw new ApiError(422);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Ce vol n'existe pas.");
  });
});
