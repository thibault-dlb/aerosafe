/** The aircraft and alert services ask for the replay when the user chose it. */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/services/ApiClient";
import { AircraftService } from "@/services/AircraftService";
import { AlertService } from "@/services/AlertService";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";

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

function client(answer: unknown) {
  return { get: vi.fn().mockResolvedValue(answer), post: vi.fn() };
}

const PAGE = { items: [], total: 0 };
const STATISTICS = { start: "2022-08-13T15:00:00Z", end: "2022-08-14T15:00:00Z", total: 0, per_rule: {} };

afterEach(() => DataModeService.reset());

describe("AircraftService in the replay", () => {
  it("adds the source to the search, after the criteria", async () => {
    const api = client([]);

    await new AircraftService(api as unknown as ApiClient, modes("replay")).search({
      icao24: "3c64",
      limit: 5,
    });

    expect(api.get).toHaveBeenCalledWith("/v1/aircraft?icao24=3c64&limit=5&source=replay");
  });

  it("adds the source to a search without criteria", async () => {
    const api = client([]);

    await new AircraftService(api as unknown as ApiClient, modes("replay")).search({});

    expect(api.get).toHaveBeenCalledWith("/v1/aircraft?source=replay");
  });

  it("asks for the record, the history, the flights and a trajectory at the simulated instant", async () => {
    const api = client({});
    const service = new AircraftService(api as unknown as ApiClient, modes("replay"));

    await service.get("abc").catch(() => undefined);
    await service.observations("abc", { limit: 50 }).catch(() => undefined);
    await service.flights("abc").catch(() => undefined);
    await service.flight("f1").catch(() => undefined);

    expect(api.get.mock.calls.map(([path]) => path)).toEqual([
      "/v1/aircraft/abc?source=replay",
      "/v1/aircraft/abc/observations?limit=50&source=replay",
      "/v1/aircraft/abc/flights?source=replay",
      "/v1/flights/f1?source=replay",
    ]);
  });

  it("leaves the live requests as they were", async () => {
    const api = client([]);
    const service = new AircraftService(api as unknown as ApiClient, modes("live"));

    await service.search({ limit: 5 });
    await service.flights("abc").catch(() => undefined);

    expect(api.get.mock.calls.map(([path]) => path)).toEqual([
      "/v1/aircraft?limit=5",
      "/v1/aircraft/abc/flights",
    ]);
  });
});

describe("AlertService in the replay", () => {
  it("adds the source to the list and to the statistics", async () => {
    const list = client(PAGE);
    await new AlertService(list as unknown as ApiClient, modes("replay")).search({ status: "active" });
    const statistics = client(STATISTICS);
    await new AlertService(statistics as unknown as ApiClient, modes("replay")).statistics();

    expect(list.get).toHaveBeenCalledWith("/v1/alerts?status=active&source=replay");
    expect(statistics.get).toHaveBeenCalledWith("/v1/alerts/statistics?source=replay");
  });

  it("keeps a period when it adds the source to the statistics", async () => {
    const api = client(STATISTICS);

    await new AlertService(api as unknown as ApiClient, modes("replay")).statistics(
      new Date("2022-08-13T15:00:00Z"),
    );

    expect(api.get).toHaveBeenCalledWith(
      "/v1/alerts/statistics?start=2022-08-13T15%3A00%3A00.000Z&source=replay",
    );
  });

  it("leaves the live requests as they were", async () => {
    const api = client(PAGE);

    await new AlertService(api as unknown as ApiClient, modes("live")).search();

    expect(api.get).toHaveBeenCalledWith("/v1/alerts");
  });
});
