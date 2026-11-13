import { describe, expect, it, vi } from "vitest";

import type { ReplayStateJson } from "@/models/ReplayState";
import type { ApiClient } from "@/services/ApiClient";

import { ReplayService } from "./ReplayService";

const JSON_STATE: ReplayStateJson = {
  available: true,
  start: "2022-08-01T00:00:00Z",
  end: "2022-08-31T23:59:59Z",
  simulated_at: "2022-08-14T15:00:00Z",
  speed: 10,
  paused: false,
  finished: false,
  server_time: "2026-11-13T10:00:00Z",
  allowed_speeds: [1, 10, 60],
};

function setup() {
  const client = {
    get: vi.fn().mockResolvedValue(JSON_STATE),
    post: vi.fn().mockResolvedValue(JSON_STATE),
  };
  return { client, service: new ReplayService(client as unknown as ApiClient) };
}

describe("ReplayService", () => {
  it("reads the clock", async () => {
    const { client, service } = setup();

    const state = await service.get();

    expect(client.get).toHaveBeenCalledWith("/v1/replay");
    expect(state.simulatedAt).toEqual(new Date("2022-08-14T15:00:00Z"));
    expect(state.speed).toBe(10);
  });

  it("starts at an instant, given in UTC, with a speed", async () => {
    const { client, service } = setup();

    await service.start(new Date("2022-08-14T15:00:00Z"), 60);

    expect(client.post).toHaveBeenCalledWith("/v1/replay/start", {
      at: "2022-08-14T15:00:00.000Z",
      speed: 60,
    });
  });

  it("pauses and resumes", async () => {
    const { client, service } = setup();

    await service.pause();
    await service.resume();

    expect(client.post).toHaveBeenNthCalledWith(1, "/v1/replay/pause");
    expect(client.post).toHaveBeenNthCalledWith(2, "/v1/replay/resume");
  });

  it("changes the speed", async () => {
    const { client, service } = setup();

    const state = await service.setSpeed(10);

    expect(client.post).toHaveBeenCalledWith("/v1/replay/speed", { speed: 10 });
    expect(state.speed).toBe(10);
  });
});
