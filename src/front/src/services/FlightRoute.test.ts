import { describe, expect, it } from "vitest";

import { FlightRoute } from "./FlightRoute";

const NORTH = [
  { x: 100, y: 500 },
  { x: 100, y: 300 },
  { x: 100, y: 100 },
];

describe("FlightRoute", () => {
  it("needs at least two waypoints", () => {
    expect(() => new FlightRoute([{ x: 0, y: 0 }])).toThrow("at least two waypoints");
  });

  it("starts at the first waypoint and ends at the last one", () => {
    const route = new FlightRoute(NORTH);

    expect(route.pointAt(0)).toEqual({ x: 100, y: 500 });
    expect(route.pointAt(1)).toEqual({ x: 100, y: 100 });
  });

  it("keeps a fraction outside 0 to 1 on the route", () => {
    const route = new FlightRoute(NORTH);

    expect(route.pointAt(-3)).toEqual(route.pointAt(0));
    expect(route.pointAt(7)).toEqual(route.pointAt(1));
  });

  it("measures a straight route", () => {
    const route = new FlightRoute(NORTH);

    expect(route.length).toBeCloseTo(400, 3);
    expect(route.pointAt(0.5).y).toBeCloseTo(300, 3);
  });

  it("moves forward as the fraction grows", () => {
    const route = new FlightRoute([
      { x: 0, y: 0 },
      { x: 300, y: 80 },
      { x: 600, y: 400 },
    ]);
    let previous = -1;

    for (let step = 0; step <= 20; step += 1) {
      const { x } = route.pointAt(step / 20);
      expect(x).toBeGreaterThanOrEqual(previous);
      previous = x;
    }
  });

  it("gives the heading clockwise from the north", () => {
    const north = new FlightRoute(NORTH);
    const east = new FlightRoute([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ]);
    const south = new FlightRoute([
      { x: 0, y: 0 },
      { x: 0, y: 400 },
    ]);
    const west = new FlightRoute([
      { x: 400, y: 0 },
      { x: 0, y: 0 },
    ]);

    expect(north.headingAt(0.5)).toBeCloseTo(0, 3);
    expect(east.headingAt(0.5)).toBeCloseTo(90, 3);
    expect(south.headingAt(0.5)).toBeCloseTo(180, 3);
    expect(west.headingAt(0.5)).toBeCloseTo(270, 3);
  });

  it("cuts the route between two fractions", () => {
    const route = new FlightRoute(NORTH);

    const part = route.slice(0.25, 0.75);

    expect(part[0]).toEqual(route.pointAt(0.25));
    expect(part[part.length - 1]).toEqual(route.pointAt(0.75));
    expect(
      part.every((point) => point.y <= route.pointAt(0.25).y && point.y >= route.pointAt(0.75).y),
    ).toBe(true);
  });

  it("cuts nothing when the end is not after the start", () => {
    const route = new FlightRoute(NORTH);

    expect(route.slice(0.5, 0.5)).toEqual([]);
    expect(route.slice(0.8, 0.2)).toEqual([]);
  });

  it("writes a list of points as SVG path data", () => {
    expect(
      FlightRoute.toPath([
        { x: 1, y: 2 },
        { x: 3.456, y: 4 },
      ]),
    ).toBe("M1.0 2.0L3.5 4.0");
    expect(FlightRoute.toPath([])).toBe("");
  });
});
