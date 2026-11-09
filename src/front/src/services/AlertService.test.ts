import { describe, expect, it, vi } from "vitest";

import type { AlertJson } from "@/models/Alert";
import { ApiClient } from "@/services/ApiClient";

import { AlertService } from "./AlertService";

const ALERT: AlertJson = {
  id: "01JC0000000000000000000A01",
  aircraft_id: "01JC0000000000000000000001",
  icao24: "3c6444",
  registration: null,
  rule_code: "R1",
  rule_description: "Délai trop long depuis le dernier contact",
  triggered_at: "2026-11-09T10:00:00Z",
  episode_ended_at: null,
  observed_value: 420,
  threshold: 300,
  unit: "s",
  message: "R1 delay since the last contact for 3c6444",
  criticality: "MEDIUM",
  processed_at: null,
};

function serviceWith(body: unknown) {
  const get = vi.fn().mockResolvedValue(body);
  const post = vi.fn().mockResolvedValue(body);
  const client = { get, post } as unknown as ApiClient;
  return { service: new AlertService(client), get, post };
}

describe("AlertService", () => {
  it("leaves empty criteria out of the query", () => {
    expect(AlertService.query({})).toBe("");
    expect(AlertService.query({ icao24: "  ", rule: "" })).toBe("");
  });

  it("sends every criterion", () => {
    const query = AlertService.query({
      rule: "R3",
      status: "unprocessed",
      criticality: "HIGH",
      icao24: " 3c6 ",
      start: new Date("2026-11-09T09:00:00Z"),
      end: new Date("2026-11-09T11:00:00Z"),
      sort: "criticality",
      order: "asc",
      limit: 20,
      offset: 40,
    });

    expect(query).toBe(
      "?rule=R3&status=unprocessed&criticality=HIGH&sort=criticality&order=asc&icao24=3c6" +
        "&start=2026-11-09T09%3A00%3A00.000Z&end=2026-11-09T11%3A00%3A00.000Z&limit=20&offset=40",
    );
  });

  it("maps a page of alerts", async () => {
    const { service, get } = serviceWith({ items: [ALERT], total: 7 });

    const page = await service.search({ status: "active" });

    expect(get).toHaveBeenCalledWith("/v1/alerts?status=active");
    expect(page.total).toBe(7);
    const [alert] = page.items;
    expect(alert.triggeredAt).toEqual(new Date("2026-11-09T10:00:00Z"));
    expect(alert.aircraftName).toBe("3c6444");
    expect(alert.active).toBe(true);
    expect(alert.processed).toBe(false);
  });

  it("lists every alert without criteria", async () => {
    const { service, get } = serviceWith({ items: [], total: 0 });

    await service.search();

    expect(get).toHaveBeenCalledWith("/v1/alerts");
  });

  it("reads one alert", async () => {
    const { service, get } = serviceWith({
      ...ALERT,
      registration: "D-AIBD",
      episode_ended_at: "2026-11-09T10:05:00Z",
    });

    const alert = await service.get(ALERT.id);

    expect(get).toHaveBeenCalledWith(`/v1/alerts/${ALERT.id}`);
    expect(alert.aircraftName).toBe("D-AIBD");
    expect(alert.active).toBe(false);
  });

  it("marks an alert as processed", async () => {
    const { service, post } = serviceWith({ ...ALERT, processed_at: "2026-11-09T10:10:00Z" });

    const alert = await service.process(ALERT.id);

    expect(post).toHaveBeenCalledWith(`/v1/alerts/${ALERT.id}/process`);
    expect(alert.processed).toBe(true);
  });

  it("reads the statistics of a period", async () => {
    const { service, get } = serviceWith({
      start: "2026-11-08T00:00:00Z",
      end: "2026-11-09T00:00:00Z",
      total: 3,
      per_rule: { R1: 2, R3: 1 },
    });

    const statistics = await service.statistics(
      new Date("2026-11-08T00:00:00Z"),
      new Date("2026-11-09T00:00:00Z"),
    );

    expect(get).toHaveBeenCalledWith(
      "/v1/alerts/statistics?start=2026-11-08T00%3A00%3A00.000Z&end=2026-11-09T00%3A00%3A00.000Z",
    );
    expect(statistics.total).toBe(3);
    expect(statistics.perRule).toEqual({ R1: 2, R3: 1 });
    expect(statistics.end).toEqual(new Date("2026-11-09T00:00:00Z"));
  });

  it("lets the API choose the default statistics period", async () => {
    const { service, get } = serviceWith({ start: "", end: "", total: 0, per_rule: {} });

    await service.statistics();

    expect(get).toHaveBeenCalledWith("/v1/alerts/statistics");
  });
});
