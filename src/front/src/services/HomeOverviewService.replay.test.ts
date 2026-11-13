import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertPage, AlertStatistics } from "@/models/Alert";

import type { AircraftService } from "./AircraftService";
import type { AlertService } from "./AlertService";
import { DataModeService } from "./DataModeService";
import { HomeOverviewService } from "./HomeOverviewService";
import { PreferenceStore } from "./PreferenceStore";

function modes(mode: "live" | "replay"): DataModeService {
  const values = new Map<string, string>();
  const service = new DataModeService(
    new PreferenceStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    }),
  );
  service.set(mode);
  return service;
}

function build(mode: "live" | "replay") {
  const aircraft = { search: vi.fn().mockResolvedValue([]) };
  const alerts = {
    search: vi.fn().mockResolvedValue(new AlertPage([], 0)),
    statistics: vi.fn().mockResolvedValue(new AlertStatistics(new Date(0), new Date(1), 0, {})),
  };
  const service = new HomeOverviewService(
    aircraft as unknown as AircraftService,
    alerts as unknown as AlertService,
    modes(mode),
  );
  return { service, aircraft };
}

afterEach(() => DataModeService.reset());

describe("HomeOverviewService in the replay", () => {
  it("looks at the whole of metropolitan France, which the replayed data covers", async () => {
    const { service, aircraft } = build("replay");

    await service.load();

    expect(aircraft.search).toHaveBeenCalledWith({
      area: HomeOverviewService.FRANCE_AREA,
      limit: 200,
    });
    expect(HomeOverviewService.FRANCE_AREA).toEqual({ south: 41.3, west: -5.2, north: 51.1, east: 9.6 });
  });

  it("keeps the Île-de-France area for the live data", async () => {
    const { service, aircraft } = build("live");

    await service.load();

    expect(aircraft.search).toHaveBeenCalledWith({ area: HomeOverviewService.AREA, limit: 200 });
  });
});
