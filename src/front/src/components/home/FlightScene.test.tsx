import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlightRoute } from "@/services/FlightRoute";
import { FlightTimeline } from "@/services/FlightTimeline";

import FlightScene from "./FlightScene";
import { ROUTE_WAYPOINTS, SceneProjection, TRAFFIC } from "./sceneGeography";

function renderScene(progress: number) {
  const route = new FlightRoute(ROUTE_WAYPOINTS);
  const frame = new FlightTimeline(route, SceneProjection.CENTER).frame(progress);
  return render(<FlightScene frame={frame} routePath="" callsign="ASF2041" label="scene" />);
}

function num(element: Element, name: string): number {
  return Number(element.getAttribute(name));
}

describe("FlightScene radar beam", () => {
  it("has the bright line at the front and a slice that fades away behind it", () => {
    const { container } = renderScene(0);
    const beam = container.querySelector('[class*="beam"]') as Element;

    const slices = Array.from(beam.querySelectorAll("path[opacity]"));
    expect(slices).toHaveLength(3);
    for (const slice of slices) {
      // Each slice ends on the line (the north, the front of a beam that turns clockwise)...
      expect(slice.getAttribute("d")).toMatch(/A720 720 0 0 1 0 -720Z$/);
      // ...and starts on its left, behind the line.
      expect(slice.getAttribute("d")).toMatch(/^M0 0L-\d/);
    }
    // The narrowest slice is the darkest: the beam is darkest next to the line and fades away.
    const reach = slices.map((slice) => Math.abs(Number(/^M0 0L(-[\d.]+)/.exec(slice.getAttribute("d")!)![1])));
    const opacity = slices.map((slice) => Number(slice.getAttribute("opacity")));
    const darkest = opacity.indexOf(Math.max(...opacity));
    expect(reach[darkest]).toBe(Math.min(...reach));
  });

  it("draws the bright line on the same side as the slices end", () => {
    const { container } = renderScene(0);

    const edge = container.querySelector('[class*="beamEdge"]') as Element;

    expect(edge.getAttribute("d")).toBe("M0 0L0 -720");
  });
});

describe("FlightScene other traffic", () => {
  it.each([0.2, 0.5, 0.8])("puts the line ahead of each aircraft, not behind it, at %s", (progress) => {
    const { container } = renderScene(progress);
    const groups = Array.from(container.querySelectorAll('[class*="traffic"]'));
    expect(groups).toHaveLength(TRAFFIC.length);

    groups.forEach((group, index) => {
      const line = group.querySelector("line") as Element;
      const dot = group.querySelector("circle") as Element;
      const { from, to } = TRAFFIC[index];
      // The line starts on the aircraft...
      expect(num(line, "x1")).toBeCloseTo(num(dot, "cx"), 3);
      expect(num(line, "y1")).toBeCloseTo(num(dot, "cy"), 3);
      // ...and points the way it flies.
      const flown = (to.x - from.x) * (num(line, "x2") - num(line, "x1")) + (to.y - from.y) * (num(line, "y2") - num(line, "y1"));
      expect(flown).toBeGreaterThan(0);
    });
  });

  it("makes the line longer for a faster aircraft", () => {
    const { container } = renderScene(0.5);
    const groups = Array.from(container.querySelectorAll('[class*="traffic"]'));

    const lengths = groups.map((group) => {
      const line = group.querySelector("line") as Element;
      return Math.hypot(num(line, "x2") - num(line, "x1"), num(line, "y2") - num(line, "y1"));
    });
    const ways = TRAFFIC.map(({ from, to }) => Math.hypot(to.x - from.x, to.y - from.y));

    const fastest = ways.indexOf(Math.max(...ways));
    const slowest = ways.indexOf(Math.min(...ways));
    expect(lengths[fastest]).toBeGreaterThan(lengths[slowest]);
    lengths.forEach((length, index) => expect(length / ways[index]).toBeCloseTo(lengths[0] / ways[0], 3));
  });
});
