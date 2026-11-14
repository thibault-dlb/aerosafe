import { describe, expect, it, vi } from "vitest";

import { Aircraft, type AircraftJson, type ObservationJson } from "@/models/Aircraft";
import type { FlightDetailJson } from "@/models/Flight";
import { ApiClient } from "@/services/ApiClient";

import { AircraftService } from "./AircraftService";

const AIRCRAFT: AircraftJson = {
  id: "01JC0000000000000000000001",
  icao24: "3c6444",
  registration: "D-AIBD",
  model: "Airbus A319",
  airline: "Lufthansa",
  last_contact_at: "2026-11-09T10:00:00Z",
  latitude: 48.85,
  longitude: 2.35,
  altitude: 10972.8,
  heading: 284,
  on_ground: false,
};

const OBSERVATION: ObservationJson = {
  last_contact_at: "2026-11-09T10:00:00Z",
  position_at: null,
  latitude: null,
  longitude: null,
  altitude: 10000,
  speed: 230,
  heading: 90,
  on_ground: false,
  flight_id: null,
};

const FLIGHT: FlightDetailJson = {
  id: "01JC0000000000000000000F01",
  aircraft_id: AIRCRAFT.id,
  icao24: "3c6444",
  registration: "D-AIBD",
  callsign: null,
  started_at: "2026-11-09T10:00:00Z",
  ended_at: null,
  origin: "Frankfurt",
  destination: null,
  trajectory: [OBSERVATION],
  gaps: [{ start: "2026-11-09T10:00:00Z", end: "2026-11-09T10:10:00Z", duration_seconds: 600 }],
  statistics: {
    observation_count: 1,
    duration_seconds: 0,
    distance_km: 0,
    mean_altitude: 10000,
    max_altitude: 10000,
    mean_speed: 230,
    max_speed: 230,
  },
};

function serviceReturning(body: unknown) {
  const get = vi.fn().mockResolvedValue(body);
  const client = { get } as unknown as ApiClient;
  return { service: new AircraftService(client), get };
}

describe("AircraftService", () => {
  it("leaves empty criteria out of the search query", () => {
    expect(AircraftService.searchQuery({})).toBe("");
    expect(AircraftService.searchQuery({ icao24: "  ", registration: "AIB ", limit: 10 })).toBe(
      "?registration=AIB&limit=10",
    );
  });

  it("sends the four bounds of the area", () => {
    const query = AircraftService.searchQuery({
      airline: "Air France",
      area: { south: 48.1, west: 1.4, north: 49.3, east: 3.6 },
    });

    expect(query).toBe("?airline=Air+France&south=48.1&west=1.4&north=49.3&east=3.6");
  });

  it("maps the search results to aircraft", async () => {
    const { service, get } = serviceReturning([AIRCRAFT]);

    const [aircraft] = await service.search({ icao24: "3c64" });

    expect(get).toHaveBeenCalledWith("/v1/aircraft?icao24=3c64");
    expect(aircraft.displayName).toBe("D-AIBD");
    expect(aircraft.lastContactAt).toEqual(new Date("2026-11-09T10:00:00Z"));
    expect(aircraft.hasPosition).toBe(true);
    expect(aircraft.heading).toBe(284);
    expect(aircraft.onGround).toBe(false);
  });

  it("accepts an aircraft sent without its heading or ground state", () => {
    const old: AircraftJson = { ...AIRCRAFT };
    delete old.heading;
    delete old.on_ground;

    const aircraft = Aircraft.fromJson(old);

    expect(aircraft.heading).toBeNull();
    expect(aircraft.onGround).toBeNull();
  });

  it("reads one aircraft record", async () => {
    const { service, get } = serviceReturning({ ...AIRCRAFT, registration: null, latitude: null });

    const aircraft = await service.get(AIRCRAFT.id);

    expect(get).toHaveBeenCalledWith(`/v1/aircraft/${AIRCRAFT.id}`);
    expect(aircraft.displayName).toBe("3C6444");
    expect(aircraft.hasPosition).toBe(false);
  });

  it("reads the observation history over a period", async () => {
    const { service, get } = serviceReturning([OBSERVATION]);

    const [observation] = await service.observations(AIRCRAFT.id, {
      start: new Date("2026-11-09T09:00:00Z"),
      end: new Date("2026-11-09T11:00:00Z"),
      limit: 100,
    });

    expect(get).toHaveBeenCalledWith(
      `/v1/aircraft/${AIRCRAFT.id}/observations?start=2026-11-09T09%3A00%3A00.000Z&end=2026-11-09T11%3A00%3A00.000Z&limit=100`,
    );
    expect(observation.altitude).toBe(10000);
    expect(observation.hasPosition).toBe(false);
  });

  it("reads the whole history when no period is given", async () => {
    const { service, get } = serviceReturning([]);

    await service.observations(AIRCRAFT.id);

    expect(get).toHaveBeenCalledWith(`/v1/aircraft/${AIRCRAFT.id}/observations`);
  });

  it("lists the flights of an aircraft", async () => {
    const { service, get } = serviceReturning([FLIGHT]);

    const [flight] = await service.flights(AIRCRAFT.id);

    expect(get).toHaveBeenCalledWith(`/v1/aircraft/${AIRCRAFT.id}/flights`);
    expect(flight.displayName).toBe("3C6444");
    expect(flight.inProgress).toBe(true);
  });

  it("reads a flight with its trajectory, gaps and statistics", async () => {
    const { service, get } = serviceReturning({ ...FLIGHT, callsign: "DLH4AB", ended_at: "2026-11-09T11:00:00Z" });

    const flight = await service.flight(FLIGHT.id);

    expect(get).toHaveBeenCalledWith(`/v1/flights/${FLIGHT.id}`);
    expect(flight.displayName).toBe("DLH4AB");
    expect(flight.inProgress).toBe(false);
    expect(flight.trajectory).toHaveLength(1);
    expect(flight.isPartial).toBe(true);
    expect(flight.gaps[0].durationSeconds).toBe(600);
    expect(flight.statistics.maxSpeed).toBe(230);
  });

  it("uses a default API client", () => {
    expect(new AircraftService()).toBeInstanceOf(AircraftService);
  });
});
