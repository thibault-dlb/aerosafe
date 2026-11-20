import { describe, expect, it } from "vitest";

import type { AirportJson, BasemapJson } from "@/models/Basemap";

import { Basemap, circleRing } from "./Basemap";
import { MapTheme } from "./MapTheme";
import type { MapView } from "./Mercator";

const SQUARE: [number, number][] = [
  [1, 47],
  [4, 47],
  [4, 50],
  [1, 50],
  [1, 47],
];
const DATA: BasemapJson = {
  land: [SQUARE],
  lakes: [
    [
      [2, 48],
      [2.5, 48],
      [2.5, 48.5],
      [2, 48],
    ],
  ],
  urban: [
    [
      [2.2, 48.7],
      [2.5, 48.7],
      [2.5, 49],
      [2.2, 48.7],
    ],
  ],
  rivers: [
    [
      [1, 48],
      [3, 49],
    ],
  ],
  area: [SQUARE],
};
const AIRPORTS: AirportJson[] = [
  { icao: "LFPG", name: "Paris Charles de Gaulle", lat: 49.01, lon: 2.55, large: true, runways: [[49.0, 2.5, 49.02, 2.6]] },
  { icao: "LFPT", name: "Pontoise", lat: 49.1, lon: 2.04, large: false, runways: [] },
];
const VIEW: MapView = { lat: 48.5, lon: 2.5, zoom: 8, width: 800, height: 600 };

/** A context that remembers what was drawn, since jsdom has no canvas. */
function recorder() {
  const calls: Record<string, number> = {};
  const texts: string[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, name: string) => (...args: unknown[]) => {
        calls[name] = (calls[name] ?? 0) + 1;
        if (name === "fillText") texts.push(String(args[0]));
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { context, calls, texts };
}

describe("Basemap", () => {
  it("draws the land, the airports and the range rings", () => {
    const basemap = new Basemap(DATA, AIRPORTS);
    const { context, calls, texts } = recorder();

    basemap.draw(context, VIEW, MapTheme.FALLBACK, "outline");

    expect(calls.fillRect).toBe(1);
    expect(calls.fill).toBeGreaterThan(3);
    expect(texts).toContain("LFPG");
    expect(texts).toContain("50 NM");
    expect(basemap.airportCount).toBe(2);
  });

  it("shows the medium airports and the runways only when zoomed in", () => {
    const basemap = new Basemap(DATA, AIRPORTS);
    const far = recorder();
    const near = recorder();

    basemap.draw(far.context, { ...VIEW, zoom: 6 }, MapTheme.FALLBACK, null);
    basemap.draw(near.context, { ...VIEW, lat: 49.05, lon: 2.3, zoom: 9 }, MapTheme.FALLBACK, null);

    expect(far.texts).not.toContain("LFPT");
    expect(near.texts).toContain("LFPT");
  });

  it("draws a rectangular zone as well as the outline, and nothing without a zone", () => {
    const basemap = new Basemap(DATA, AIRPORTS);
    const outline = recorder();
    const rectangle = recorder();
    const none = recorder();

    basemap.draw(outline.context, VIEW, MapTheme.FALLBACK, "outline");
    basemap.draw(rectangle.context, VIEW, MapTheme.FALLBACK, { south: 48, west: 1.4, north: 49.3, east: 3.6 });
    basemap.draw(none.context, VIEW, MapTheme.FALLBACK, null);

    expect(outline.calls.setLineDash).toBeGreaterThan(none.calls.setLineDash);
    expect(rectangle.calls.rect).toBe(1);
    expect(none.calls.rect).toBeUndefined();
  });

  it("skips what is out of view", () => {
    const basemap = new Basemap(DATA, AIRPORTS);
    const { context, calls } = recorder();

    basemap.draw(context, { ...VIEW, lat: -30, lon: 100 }, MapTheme.FALLBACK, null);

    expect(calls.moveTo ?? 0).toBeLessThan(40);
  });

  it("widens the graticule step as the zoom goes down", () => {
    expect(Basemap.graticuleStep(4)).toBe(5);
    expect(Basemap.graticuleStep(7)).toBe(1);
    expect(Basemap.graticuleStep(9)).toBe(0.25);
    expect(Basemap.graticuleStep(11)).toBe(0.1);
  });

  it("loads the files of the build", async () => {
    const basemap = await Basemap.load();

    expect(basemap.airportCount).toBeGreaterThan(100);
  });
});

describe("circleRing", () => {
  it("puts every point of the ring at the radius of the circle", () => {
    const circle = { latitude: 48.65, longitude: 2.5, radiusKm: 463 };
    const toRadians = Math.PI / 180;

    const ring = circleRing(circle, 12);

    expect(ring).toHaveLength(12);
    for (const [lon, lat] of ring) {
      // Haversine distance from the centre, in kilometres.
      const dLat = (lat - circle.latitude) * toRadians;
      const dLon = (lon - circle.longitude) * toRadians;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(circle.latitude * toRadians) * Math.cos(lat * toRadians) * Math.sin(dLon / 2) ** 2;
      expect(2 * 6371.0088 * Math.asin(Math.sqrt(a))).toBeCloseTo(463, 3);
    }
    // The first point is due north of the centre.
    expect(ring[0][0]).toBeCloseTo(2.5, 6);
    expect(ring[0][1]).toBeGreaterThan(48.65);
  });

  it("draws a circular zone as a closed ring", () => {
    const basemap = new Basemap(DATA, AIRPORTS);
    const circle = recorder();

    basemap.draw(circle.context, VIEW, MapTheme.FALLBACK, { latitude: 48.65, longitude: 2.5, radiusKm: 463 });

    expect(circle.calls.rect).toBeUndefined();
    expect(circle.calls.closePath).toBeGreaterThan(0);
    expect(circle.calls.setLineDash).toBeGreaterThan(0);
  });
});
