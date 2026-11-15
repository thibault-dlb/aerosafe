import { screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Aircraft, Observation } from "@/models/Aircraft";
import { Alert, AlertPage } from "@/models/Alert";
import { Flight } from "@/models/Flight";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";
import type { AlertService } from "@/services/AlertService";
import { MapService } from "@/services/MapService";
import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import AircraftRecord, { HISTORY_SIZE } from "./AircraftRecord";

const ID = "01JC0000000000000000000001";
const AIRCRAFT = new Aircraft(ID, "3c6444", "D-AIBD", "Airbus A319", "Lufthansa", new Date("2026-11-09T10:00:00Z"), 48.85, 2.35, 10000, 90, false);
const NOWHERE = new Aircraft(ID, "4ca123", null, null, null, null, null, null);
const OBSERVATIONS = [
  new Observation(new Date("2026-11-09T09:59:30Z"), null, null, null, null, null, null, true, null),
  new Observation(new Date("2026-11-09T10:00:00Z"), null, 48.85, 2.35, 10000, 230, 90, false, null),
];
const FLIGHT = new Flight("01JC0000000000000000000F01", ID, "3c6444", "D-AIBD", "DLH4AB", new Date("2026-11-09T09:00:00Z"), null, "Frankfurt", null);

function alert(criticality: "LOW" | "MEDIUM" | "HIGH" | null, icao24 = "3c6444") {
  return new Alert("A", "R3", new Date(), "m", "AC", icao24, null, "d", 1, 1, "m/s", criticality);
}

afterEach(() => {
  vi.restoreAllMocks();
});

function renderRecord(
  service: Partial<AircraftService>,
  options: { role?: "USER" | "SUPERVISOR"; alerts?: Partial<AlertService>; preferences?: Record<string, string> } = {},
) {
  const { role = "USER", alerts, preferences } = options;
  renderInApp(
    <Routes>
      <Route
        path="/aircraft/:aircraftId"
        element={<AircraftRecord service={service as AircraftService} alertService={alerts as AlertService | undefined} />}
      />
    </Routes>,
    { path: `/aircraft/${ID}`, session: fakeSession("authenticated", role), preferences },
  );
}

function serviceWith(aircraft: Aircraft, observations: Observation[], flights: Flight[]) {
  return {
    get: vi.fn().mockResolvedValue(aircraft),
    observations: vi.fn().mockResolvedValue(observations),
    flights: vi.fn().mockResolvedValue(flights),
  };
}

describe("AircraftRecord", () => {
  it("shows its title while loading", () => {
    renderRecord({ get: () => new Promise(() => {}), observations: vi.fn(), flights: vi.fn() });

    expect(screen.getByRole("heading", { name: "Fiche aéronef" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chargement");
  });

  it("is headed by the aircraft, with a way back up and its identity", async () => {
    const service = serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]);
    renderRecord(service);

    expect(await screen.findByRole("heading", { level: 1, name: "D-AIBD" })).toBeInTheDocument();
    expect(service.get).toHaveBeenCalledWith(ID);
    expect(service.observations).toHaveBeenCalledWith(ID, { limit: HISTORY_SIZE });
    expect(screen.getByRole("link", { name: "Aéronefs" })).toHaveAttribute("href", "/aircraft");
    expect(screen.getByText(/Airbus A319 · Lufthansa/)).toBeInTheDocument();
    expect(screen.getByText("3c6444")).toBeInTheDocument();
    expect(screen.getAllByText("En vol").length).toBeGreaterThan(0);
  });

  it("shows the latest parameters as figures", async () => {
    renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]));

    await screen.findByRole("heading", { level: 1, name: "D-AIBD" });
    const figures = within(screen.getByRole("banner"));
    expect(figures.getByText("10000 m")).toBeInTheDocument();
    expect(figures.getByText("828 km/h")).toBeInTheDocument();
    expect(figures.getByText("90 °")).toBeInTheDocument();
  });

  it("shows the figures in the unit system chosen", async () => {
    renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]), { preferences: { "aerosafe.units": "aeronautical" } });

    await screen.findByRole("heading", { level: 1, name: "D-AIBD" });
    expect(screen.getAllByText("32808 ft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("447 kt").length).toBeGreaterThan(0);
  });

  it("gives the map the heading and the state of the aircraft", async () => {
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]));

    await screen.findByRole("heading", { level: 1, name: "D-AIBD" });

    await waitFor(() => expect(showAircraft.mock.lastCall?.[0][0]).toMatchObject({ heading: 90, onGround: false, label: "D-AIBD", criticality: null }));
    expect(screen.getByRole("img", { name: "Carte de 1 aéronef(s)" })).toBeInTheDocument();
  });

  it("lists the flights and the latest observations", async () => {
    renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]));

    expect(await screen.findByRole("link", { name: "DLH4AB" })).toHaveAttribute("href", "/flights/01JC0000000000000000000F01");
    const [flightRow] = within(screen.getAllByRole("table")[0]).getAllByRole("row").slice(1);
    expect(flightRow).toHaveTextContent("En cours");
    expect(flightRow).toHaveTextContent("Frankfurt → ?");

    const rows = within(screen.getAllByRole("table")[1]).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("10000 m");
    expect(rows[1]).toHaveTextContent("En vol");
    expect(rows[2]).toHaveTextContent("Au sol");
    expect(rows[2]).toHaveTextContent("–");
  });

  it("shows a flight with no airport as a dash, and one that ended with its end", async () => {
    const ended = new Flight("F2", ID, "3c6444", "D-AIBD", null, new Date("2026-11-08T09:00:00Z"), new Date("2026-11-08T10:00:00Z"), null, null);
    renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [ended]));

    const [row] = within((await screen.findAllByRole("table"))[0]).getAllByRole("row").slice(1);
    expect(row).toHaveTextContent("–");
    expect(row).not.toHaveTextContent("En cours");
  });

  it("says when nothing was recorded", async () => {
    renderRecord(serviceWith(NOWHERE, [], []));

    expect(await screen.findByText("Aucune position connue.")).toBeInTheDocument();
    expect(screen.getByText("Aucun vol enregistré.")).toBeInTheDocument();
    expect(screen.getByText("Aucune observation enregistrée.")).toBeInTheDocument();
    expect(screen.getByText("Jamais")).toBeInTheDocument();
    expect(screen.getByText(/Inconnu · Inconnu/)).toBeInTheDocument();
    expect(screen.queryByText("En vol")).not.toBeInTheDocument();
  });

  it("says when the aircraft does not exist", async () => {
    renderRecord({
      get: vi.fn().mockRejectedValue(new ApiError(404)),
      observations: vi.fn().mockResolvedValue([]),
      flights: vi.fn().mockResolvedValue([]),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("n'existe pas");
    expect(screen.getByRole("link", { name: "Retour à la recherche" })).toBeInTheDocument();
  });

  it("says the aircraft does not exist when its identifier is not valid", async () => {
    renderRecord({
      get: vi.fn().mockRejectedValue(new ApiError(422)),
      observations: vi.fn().mockResolvedValue([]),
      flights: vi.fn().mockResolvedValue([]),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Cet aéronef n'existe pas.");
  });

  describe("the alerts in progress", () => {
    it("are not looked for, nor shown, for a User", async () => {
      const search = vi.fn();
      renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]), { alerts: { search } });

      await screen.findByRole("heading", { level: 1, name: "D-AIBD" });

      expect(search).not.toHaveBeenCalled();
      expect(screen.queryByText(/alerte.* en cours/)).not.toBeInTheDocument();
    });

    it("are shown to a Supervisor with the highest criticality, and colour the marker", async () => {
      const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
      const search = vi.fn().mockResolvedValue(new AlertPage([alert("MEDIUM"), alert("HIGH"), alert("LOW", "3c6445")], 3));
      renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]), { role: "SUPERVISOR", alerts: { search } });

      expect(await screen.findByText("2 alertes en cours")).toBeInTheDocument();
      expect(search).toHaveBeenCalledWith({ icao24: "3c6444", status: "active", limit: 50 });
      expect(screen.getByText("Haute")).toBeInTheDocument();
      await waitFor(() => expect(showAircraft.mock.lastCall?.[0][0]).toMatchObject({ criticality: "HIGH" }));
    });

    it("says one alert in the singular", async () => {
      const search = vi.fn().mockResolvedValue(new AlertPage([alert(null)], 1));
      renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]), { role: "SUPERVISOR", alerts: { search } });

      expect(await screen.findByText("1 alerte en cours")).toBeInTheDocument();
    });

    it("show nothing when there is none, or when they cannot be read", async () => {
      const search = vi.fn().mockRejectedValue(new ApiError(500));
      renderRecord(serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]), { role: "SUPERVISOR", alerts: { search } });

      await screen.findByRole("heading", { level: 1, name: "D-AIBD" });
      await waitFor(() => expect(search).toHaveBeenCalled());

      expect(screen.queryByText(/alerte.* en cours/)).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
