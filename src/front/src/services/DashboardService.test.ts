import { describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
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
    expect(search).toHaveBeenNthCalledWith(1, { area: DashboardService.AREA, limit: 200 });
    expect(search).toHaveBeenNthCalledWith(2, { area: DashboardService.FRANCE_AREA, limit: 200 });
  });
});
