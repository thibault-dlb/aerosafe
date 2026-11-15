import { describe, expect, it } from "vitest";

import { CollectionRun, CollectionSummary, Dashboard, DashboardStatistics } from "./Dashboard";

describe("Dashboard", () => {
  it("reads the answer of the API", () => {
    const dashboard = Dashboard.fromJson({
      counters: { active_alerts: 4, unprocessed_alerts: 9, alerts_24h: 17 },
      active_alerts: [
        {
          id: "01A",
          aircraft_id: "01B",
          icao24: "3c6444",
          registration: null,
          rule_code: "R1",
          rule_description: "d",
          triggered_at: "2026-11-14T10:00:00Z",
          episode_ended_at: null,
          observed_value: 1,
          threshold: 2,
          unit: "s",
          message: "m",
          criticality: "HIGH",
          processed_at: null,
        },
      ],
      collection: {
        enabled: true,
        paused: false,
        running: true,
        last_success_at: "2026-11-14T09:59:00Z",
        remaining_credits: 100,
        recent_runs: [{ started_at: "2026-11-14T09:58:00Z", status: "FAILED" }],
      },
    });

    expect([dashboard.activeAlerts, dashboard.unprocessedAlerts, dashboard.alertsLast24h]).toEqual([4, 9, 17]);
    expect(dashboard.latestAlerts[0].ruleCode).toBe("R1");
    expect(dashboard.collection.running).toBe(true);
    expect(dashboard.collection.lastSuccessAt).toEqual(new Date("2026-11-14T09:59:00Z"));
    expect(dashboard.collection.recentRuns[0].collected).toBe(false);
  });

  it("knows no run and no success", () => {
    const summary = CollectionSummary.fromJson({
      enabled: false,
      paused: true,
      running: false,
      last_success_at: null,
      remaining_credits: null,
      recent_runs: [],
    });

    expect(summary.lastSuccessAt).toBeNull();
    expect(summary.recentRuns).toEqual([]);
  });

  it.each([
    ["SUCCESS", true],
    ["PARTIAL", true],
    ["FAILED", false],
    ["RATE_LIMITED", false],
  ])("counts a %s run as collected: %s", (status, collected) => {
    expect(new CollectionRun(new Date(), status).collected).toBe(collected);
  });
});

describe("DashboardStatistics", () => {
  const statistics = DashboardStatistics.fromJson({
    period: "24h",
    unit: "hour",
    start: "2026-11-13T11:00:00Z",
    end: "2026-11-14T10:30:00Z",
    total: 7,
    slices: [
      { start: "2026-11-13T11:00:00Z", total: 4, per_rule: { R3: 4 } },
      { start: "2026-11-14T10:00:00Z", total: 3, per_rule: { R1: 2, R3: 1 } },
    ],
  });

  it("lists the rules of the period in order", () => {
    expect(statistics.ruleCodes).toEqual(["R1", "R3"]);
  });

  it("gives the tallest bar as the scale", () => {
    expect(statistics.peak).toBe(4);
    expect(new DashboardStatistics("7d", "day", 0, []).peak).toBe(0);
  });
});
