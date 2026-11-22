import { describe, expect, it, vi } from "vitest";

import { Aircraft, Observation } from "@/models/Aircraft";
import { CollectionSummary } from "@/models/Dashboard";
import type { AircraftService } from "@/services/AircraftService";
import type { ApiClient } from "@/services/ApiClient";
import { DataModeService } from "@/services/DataModeService";

import { DashboardService } from "./DashboardService";

const T0 = new Date("2026-11-14T10:00:00Z");

function modes(replay: boolean): DataModeService {
  return { isReplay: () => replay, withSource: (query: string) => (replay ? (query ? `${query}&source=replay` : "?source=replay") : query) } as unknown as DataModeService;
}

describe("DashboardService", () => {
  it("reads the dashboard", async () => {
    const get = vi.fn().mockResolvedValue({
      counters: { active_alerts: 1, unprocessed_alerts: 2, alerts_24h: 3 },
      active_alerts: [],
      collection: { enabled: true, paused: false, running: false, last_success_at: null, remaining_credits: null, recent_runs: [] },
    });
    const service = new DashboardService({ get } as unknown as ApiClient, modes(false));

    const dashboard = await service.load();

    expect(get).toHaveBeenCalledWith("/v1/dashboard");
    expect(dashboard.unprocessedAlerts).toBe(2);
  });

  it("follows the replay", async () => {
    const get = vi.fn().mockResolvedValue({ period: "7d", unit: "day", start: T0, end: T0, total: 0, slices: [] });
    const service = new DashboardService({ get } as unknown as ApiClient, modes(true));

    await service.statistics("7d");

    expect(get).toHaveBeenCalledWith("/v1/dashboard/statistics?period=7d&source=replay");
  });

  it("reads the aircraft of the area the data covers, with a position only", async () => {
    const placed = new Aircraft("01A", "3c6444", null, null, null, T0, 48.8, 2.3);
    const lost = new Aircraft("01B", "3c6445", null, null, null, T0, null, null);
    const search = vi.fn().mockResolvedValue([placed, lost]);
    const aircraft = { search } as unknown as AircraftService;

    const live = await new DashboardService({} as ApiClient, modes(false), aircraft).trackedAircraft();
    await new DashboardService({} as ApiClient, modes(true), aircraft).trackedAircraft();

    expect(live).toEqual([placed]);
    expect(search).toHaveBeenNthCalledWith(1, { area: DashboardService.AREA, limit: 2000, heardWithinSeconds: 60 });
    expect(search).toHaveBeenNthCalledWith(2, { area: DashboardService.HISTORICAL_AREA, limit: 2000 });
  });

  it("reads the live aircraft in the area of the collection, heard within two of its periods", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const aircraft = { search } as unknown as AircraftService;
    const collection = CollectionSummary.fromJson({
      source: "opensky",
      period_seconds: 120,
      area: { south: 41.3, west: -5.2, north: 51.1, east: 9.6 },
      enabled: true,
      paused: false,
      running: false,
      last_success_at: null,
      remaining_credits: null,
      recent_runs: [],
    });

    await new DashboardService({} as ApiClient, modes(false), aircraft).trackedAircraft(collection);

    expect(search).toHaveBeenCalledWith({
      area: { south: 41.3, west: -5.2, north: 51.1, east: 9.6 },
      limit: 2000,
      heardWithinSeconds: 240,
    });
  });

  it("reads a live source that is not collected directly, with a position only", async () => {
    const placed = new Aircraft("3c6444", "3c6444", null, null, null, T0, 48.8, 2.3);
    const lost = new Aircraft("3c6445", "3c6445", null, null, null, T0, null, null);
    const preview = vi.fn().mockResolvedValue([placed, lost]);
    const search = vi.fn();
    const aircraft = { preview, search } as unknown as AircraftService;
    const off = new CollectionSummary(false, false, false, null, null, [], "adsbfi", 5);

    const found = await new DashboardService({} as ApiClient, modes(false), aircraft).trackedAircraft(off);

    expect(found).toEqual([placed]);
    expect(search).not.toHaveBeenCalled();
  });

  it("keeps reading the base while the collection is on, unknown, or the replay is shown", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const preview = vi.fn();
    const aircraft = { preview, search } as unknown as AircraftService;
    const on = new CollectionSummary(true, false, false, null, null, [], "adsbfi", 5);
    const off = new CollectionSummary(false, false, false, null, null, [], "adsbfi", 5);

    await new DashboardService({} as ApiClient, modes(false), aircraft).trackedAircraft(on);
    await new DashboardService({} as ApiClient, modes(false), aircraft).trackedAircraft(null);
    await new DashboardService({} as ApiClient, modes(true), aircraft).trackedAircraft(off);

    expect(preview).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(3);
  });

  it("knows when a source is shown as a preview", () => {
    const off = new CollectionSummary(false, false, false, null, null, []);

    expect(DashboardService.isPreview(off, false)).toBe(true);
    expect(DashboardService.isPreview(off, true)).toBe(false);
    expect(DashboardService.isPreview(null, false)).toBe(false);
  });

  it("keeps the live aircraft heard in the last minute at least", () => {
    expect(DashboardService.heardWithinSeconds(5)).toBe(60);
    expect(DashboardService.heardWithinSeconds(null)).toBe(60);
    expect(DashboardService.heardWithinSeconds(120)).toBe(240);
  });

  it("reads the whole flight of an aircraft", async () => {
    const at = new Date("2026-11-14T10:00:00Z");
    const observations = [new Observation(at, at, 48.8, 2.3, 9000, 200, 90, false, "F1")];
    const observationsOf = vi.fn().mockResolvedValue(observations);
    const service = new DashboardService({} as ApiClient, modes(false), { observations: observationsOf } as unknown as AircraftService);

    const points = await service.flightOf("01A");

    expect(observationsOf).toHaveBeenCalledWith("01A", { limit: 5000 });
    expect(points).toEqual([{ at: at.getTime(), lat: 48.8, lon: 2.3, altitude: 9000 }]);
  });
});
