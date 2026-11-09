import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Aircraft, Observation } from "@/models/Aircraft";
import { Flight } from "@/models/Flight";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";

import AircraftRecord, { HISTORY_SIZE } from "./AircraftRecord";

const ID = "01JC0000000000000000000001";
const AIRCRAFT = new Aircraft(ID, "3c6444", "D-AIBD", "Airbus A319", "Lufthansa", new Date("2026-11-09T10:00:00Z"), 48.85, 2.35);
const NOWHERE = new Aircraft(ID, "4ca123", null, null, null, null, null, null);
const OBSERVATIONS = [
  new Observation(new Date("2026-11-09T09:59:30Z"), null, null, null, null, null, null, true, null),
  new Observation(new Date("2026-11-09T10:00:00Z"), null, 48.85, 2.35, 10000, 230, 90, false, null),
];
const FLIGHT = new Flight("01JC0000000000000000000F01", ID, "3c6444", "D-AIBD", "DLH4AB", new Date("2026-11-09T09:00:00Z"), null, "Frankfurt", null);

function renderRecord(service: Partial<AircraftService>) {
  render(
    <MemoryRouter initialEntries={[`/aircraft/${ID}`]}>
      <Routes>
        <Route path="/aircraft/:aircraftId" element={<AircraftRecord service={service as AircraftService} />} />
      </Routes>
    </MemoryRouter>,
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

    expect(screen.getByRole("heading", { name: "Aircraft record" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows the aircraft, its flights and its latest parameters", async () => {
    const service = serviceWith(AIRCRAFT, OBSERVATIONS, [FLIGHT]);
    renderRecord(service);

    expect(await screen.findByRole("heading", { name: "D-AIBD" })).toBeInTheDocument();
    expect(service.get).toHaveBeenCalledWith(ID);
    expect(service.observations).toHaveBeenCalledWith(ID, { limit: HISTORY_SIZE });
    expect(screen.getByText("Airbus A319")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DLH4AB" })).toHaveAttribute("href", "/flights/01JC0000000000000000000F01");
    expect(screen.getByText(/in progress/)).toHaveTextContent("Frankfurt → ?");
    expect(screen.getByRole("img", { name: "Map of 1 aircraft" })).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("10000 m");
    expect(rows[1]).toHaveTextContent("Airborne");
    expect(rows[2]).toHaveTextContent("On ground");
    expect(rows[2]).toHaveTextContent("–");
  });

  it("says when nothing was recorded", async () => {
    renderRecord(serviceWith(NOWHERE, [], []));

    expect(await screen.findByText("No known position.")).toBeInTheDocument();
    expect(screen.getByText("No flight recorded.")).toBeInTheDocument();
    expect(screen.getByText("No observation recorded.")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).toHaveLength(3);
  });

  it("says when the aircraft does not exist", async () => {
    renderRecord({
      get: vi.fn().mockRejectedValue(new ApiError(404)),
      observations: vi.fn().mockResolvedValue([]),
      flights: vi.fn().mockResolvedValue([]),
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("does not exist");
    expect(screen.getByRole("link", { name: "Back to the search" })).toBeInTheDocument();
  });
});
