import { describe, expect, it } from "vitest";

import { ReplayState, type ReplayStateJson } from "./ReplayState";

const START = "2022-08-01T00:00:00Z";
const END = "2022-08-31T23:59:59Z";
const AT = "2022-08-14T15:00:00Z";
const RECEIVED = 1_000_000;

function json(changes: Partial<ReplayStateJson> = {}): ReplayStateJson {
  return {
    available: true,
    start: START,
    end: END,
    simulated_at: AT,
    speed: 10,
    paused: false,
    finished: false,
    server_time: "2026-11-13T10:00:00Z",
    allowed_speeds: [1, 10, 60],
    ...changes,
  };
}

function state(changes: Partial<ReplayStateJson> = {}): ReplayState {
  return ReplayState.fromJson(json(changes), RECEIVED);
}

describe("ReplayState", () => {
  it("reads the answer of the API", () => {
    const replay = state();

    expect(replay.available).toBe(true);
    expect(replay.start).toEqual(new Date(START));
    expect(replay.end).toEqual(new Date(END));
    expect(replay.simulatedAt).toEqual(new Date(AT));
    expect(replay.speed).toBe(10);
    expect(replay.allowedSpeeds).toEqual([1, 10, 60]);
  });

  it("has no dates when nothing is imported or started", () => {
    const replay = state({ available: false, start: null, end: null, simulated_at: null });

    expect(replay.start).toBeNull();
    expect(replay.end).toBeNull();
    expect(replay.started).toBe(false);
    expect(replay.now(RECEIVED + 5_000)).toBeNull();
  });
});

describe("now", () => {
  it("is the instant of the API at the moment it answered", () => {
    expect(state().now(RECEIVED)).toEqual(new Date(AT));
  });

  it("moves with the speed for each real second", () => {
    expect(state().now(RECEIVED + 6_000)).toEqual(new Date("2022-08-14T15:01:00Z"));
    expect(state({ speed: 60 }).now(RECEIVED + 6_000)).toEqual(new Date("2022-08-14T15:06:00Z"));
  });

  it("stays put while paused", () => {
    expect(state({ paused: true }).now(RECEIVED + 60_000)).toEqual(new Date(AT));
  });

  it("stops at the end of the data", () => {
    const replay = state({ simulated_at: "2022-08-31T23:59:50Z", speed: 60 });

    expect(replay.now(RECEIVED + 600_000)).toEqual(new Date(END));
  });

  it("stays put once finished", () => {
    const replay = state({ simulated_at: END, finished: true, paused: true });

    expect(replay.running).toBe(false);
    expect(replay.now(RECEIVED + 60_000)).toEqual(new Date(END));
  });

  it("never goes back when the local clock is behind", () => {
    expect(state().now(RECEIVED - 10_000)).toEqual(new Date(AT));
  });

  it("runs without an end when the period is unknown", () => {
    const replay = state({ end: null });

    expect(replay.now(RECEIVED + 1_000)).toEqual(new Date("2022-08-14T15:00:10Z"));
  });

  it("tells whether the clock is moving", () => {
    expect(state().running).toBe(true);
    expect(state({ paused: true }).running).toBe(false);
    expect(state({ simulated_at: null }).running).toBe(false);
  });
});
