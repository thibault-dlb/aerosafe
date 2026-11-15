import { describe, expect, it } from "vitest";

import { AircraftPolling } from "./AircraftPolling";

describe("AircraftPolling", () => {
  it("reads every two seconds at normal speed and every second when the replay is fast", () => {
    expect(AircraftPolling.replay(1)).toBe(2000);
    expect(AircraftPolling.replay(10)).toBe(2000);
    expect(AircraftPolling.replay(30)).toBe(1000);
    expect(AircraftPolling.replay(60)).toBe(1000);
  });

  it("reads every two seconds at most when the speed is wrong", () => {
    expect(AircraftPolling.replay(0)).toBe(2000);
  });
});
