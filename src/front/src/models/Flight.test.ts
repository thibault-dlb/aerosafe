import { describe, expect, it } from "vitest";

import { Observation } from "@/models/Aircraft";

import { Flight, FlightDetail, FlightStatistics, TrajectoryGap } from "./Flight";

const T0 = Date.parse("2026-11-09T10:00:00Z");
const FLIGHT = new Flight("F", "A", "3c6444", null, null, new Date(T0), null, null, null);
const STATS = new FlightStatistics(0, 0, 0, null, null, null, null);

function at(seconds: number, located = true): Observation {
  return new Observation(
    new Date(T0 + seconds * 1000),
    null,
    located ? 48 + seconds / 1000 : null,
    located ? 2 : null,
    null,
    null,
    null,
    false,
    "F",
  );
}

function gap(from: number, to: number): TrajectoryGap {
  return new TrajectoryGap(new Date(T0 + from * 1000), new Date(T0 + to * 1000), to - from);
}

function times(segments: Observation[][]): number[][] {
  return segments.map((segment) => segment.map((p) => (p.lastContactAt.getTime() - T0) / 1000));
}

describe("FlightDetail.segments", () => {
  it("keeps a complete trajectory in one segment", () => {
    const flight = new FlightDetail(FLIGHT, [at(0), at(30), at(60)], [], STATS);

    expect(times(flight.segments())).toEqual([[0, 30, 60]]);
    expect(flight.isPartial).toBe(false);
  });

  it("starts a new segment after each gap", () => {
    const flight = new FlightDetail(
      FLIGHT,
      [at(0), at(30), at(900), at(930), at(2000)],
      [gap(30, 900), gap(930, 2000)],
      STATS,
    );

    expect(times(flight.segments())).toEqual([[0, 30], [900, 930], [2000]]);
    expect(flight.isPartial).toBe(true);
  });

  it("leaves out the observations without a position", () => {
    const flight = new FlightDetail(FLIGHT, [at(0), at(30, false), at(60)], [], STATS);

    expect(times(flight.segments())).toEqual([[0, 60]]);
  });

  it("has no segment without positions", () => {
    expect(new FlightDetail(FLIGHT, [at(0, false)], [], STATS).segments()).toEqual([]);
  });
});
