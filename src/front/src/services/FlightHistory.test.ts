import { describe, expect, it } from "vitest";

import { Observation } from "@/models/Aircraft";

import { FlightHistory } from "./FlightHistory";

const START = Date.UTC(2022, 7, 6, 8, 0, 0);

function observation(minutes: number, flightId: string | null, lat: number | null = 48, altitude: number | null = 10_000): Observation {
  const at = new Date(START + minutes * 60_000);
  return new Observation(at, at, lat, lat === null ? null : 2, altitude, 200, 90, false, flightId);
}

describe("FlightHistory", () => {
  it("keeps every point of the flight of the latest observation", () => {
    const points = FlightHistory.points([
      observation(0, "OLD"),
      observation(300, "NEW", 48.1),
      observation(310, "NEW", 48.2),
      observation(320, "NEW", 48.3),
    ]);

    expect(points.map((point) => point.lat)).toEqual([48.1, 48.2, 48.3]);
  });

  it("follows the run of close observations when the data has no flight", () => {
    const points = FlightHistory.points([
      observation(0, null, 40),
      observation(5, null, 41),
      observation(200, null, 48.1),
      observation(210, null, 48.2),
    ]);

    expect(points.map((point) => point.lat)).toEqual([48.1, 48.2]);
  });

  it("leaves out the observations without a position", () => {
    const points = FlightHistory.points([observation(0, "F", 48), observation(5, "F", null), observation(10, "F", 48.2)]);

    expect(points).toHaveLength(2);
  });

  it("has nothing for an aircraft with no observation", () => {
    expect(FlightHistory.points([])).toEqual([]);
  });

  it("adds a newer point and ignores an older one", () => {
    const points = FlightHistory.points([observation(0, "F"), observation(5, "F")]);
    const last = points.at(-1);

    expect(FlightHistory.append(points, { at: (last?.at ?? 0) + 1000, lat: 48, lon: 2, altitude: null })).toHaveLength(3);
    expect(FlightHistory.append(points, { at: (last?.at ?? 0) - 1000, lat: 48, lon: 2, altitude: null })).toBe(points);
    expect(FlightHistory.append([], { at: 1, lat: 1, lon: 1, altitude: null })).toHaveLength(1);
  });
});
