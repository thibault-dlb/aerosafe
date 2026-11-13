import { describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import { AlertPage, AlertStatistics } from "@/models/Alert";

import type { AircraftService } from "./AircraftService";
import type { AlertService } from "./AlertService";
import { ApiError } from "./ApiClient";
import { LiveOverviewService } from "./LiveOverviewService";

const WITH_POSITION = new Aircraft("1", "3944ee", "F-HBAB", null, null, null, 48.8, 2.3);
const WITHOUT_POSITION = new Aircraft("2", "3944ef", null, null, null, null, null, null);
const STATISTICS = new AlertStatistics(new Date(0), new Date(1), 7, { R1: 7 });

function build(overrides: {
  aircraft?: () => Promise<Aircraft[]>;
  search?: () => Promise<AlertPage>;
  statistics?: () => Promise<AlertStatistics>;
}) {
  const aircraft = {
    search: vi.fn(overrides.aircraft ?? (() => Promise.resolve([WITH_POSITION, WITHOUT_POSITION]))),
  };
  const alerts = {
    search: vi.fn(overrides.search ?? (() => Promise.resolve(new AlertPage([], 3)))),
    statistics: vi.fn(overrides.statistics ?? (() => Promise.resolve(STATISTICS))),
  };
  const service = new LiveOverviewService(
    aircraft as unknown as AircraftService,
    alerts as unknown as AlertService,
  );
  return { service, aircraft, alerts };
}

describe("LiveOverviewService", () => {
  it("loads the aircraft with a position and the alert counts", async () => {
    const { service } = build({});

    const overview = await service.load();

    expect(overview.aircraft).toEqual({ state: "ready", data: [WITH_POSITION] });
    expect(overview.activeAlerts).toEqual({ state: "ready", data: 3 });
    expect(overview.dayAlerts).toEqual({ state: "ready", data: 7 });
  });

  it("asks for the Île-de-France area, and the active alerts only", async () => {
    const { service, aircraft, alerts } = build({});

    await service.load();

    expect(aircraft.search).toHaveBeenCalledWith({ area: LiveOverviewService.AREA, limit: 200 });
    expect(alerts.search).toHaveBeenCalledWith({ status: "active", limit: 1 });
  });

  it("says when the user is not logged in", async () => {
    const { service } = build({ aircraft: () => Promise.reject(new ApiError(401)) });

    expect((await service.load()).aircraft).toEqual({ state: "unauthenticated" });
  });

  it("says when the user is not a Supervisor and keeps the other figures", async () => {
    const { service } = build({
      search: () => Promise.reject(new ApiError(403)),
      statistics: () => Promise.reject(new ApiError(403)),
    });

    const overview = await service.load();

    expect(overview.activeAlerts).toEqual({ state: "forbidden" });
    expect(overview.dayAlerts).toEqual({ state: "forbidden" });
    expect(overview.aircraft.state).toBe("ready");
  });

  it("reports any other failure for the part concerned only", async () => {
    const { service } = build({
      aircraft: () => Promise.reject(new TypeError("network")),
      statistics: () => Promise.reject(new ApiError(500)),
    });

    const overview = await service.load();

    expect(overview.aircraft).toEqual({ state: "failed" });
    expect(overview.dayAlerts).toEqual({ state: "failed" });
    expect(overview.activeAlerts.state).toBe("ready");
  });
});
