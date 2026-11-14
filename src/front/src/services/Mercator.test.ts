import { describe, expect, it } from "vitest";

import { Mercator, type MapView } from "./Mercator";

const VIEW: MapView = { lat: 48.85, lon: 2.35, zoom: 8, width: 800, height: 600 };

describe("Mercator", () => {
  it("puts the centre of the view in the middle of the screen", () => {
    const point = Mercator.toScreen(VIEW, VIEW.lat, VIEW.lon);

    expect(point.x).toBeCloseTo(400, 6);
    expect(point.y).toBeCloseTo(300, 6);
  });

  it("goes back from a pixel to the place", () => {
    const point = Mercator.toScreen(VIEW, 47.2, 3.9);
    const place = Mercator.fromScreen(VIEW, point.x, point.y);

    expect(place.lat).toBeCloseTo(47.2, 6);
    expect(place.lon).toBeCloseTo(3.9, 6);
  });

  it("doubles the pixels of the world at each zoom level", () => {
    expect(Mercator.scale(1)).toBe(2 * Mercator.scale(0));
    expect(Mercator.scale(0)).toBe(256);
  });

  it("puts the equator and the date line where Leaflet does", () => {
    expect(Mercator.y(0)).toBeCloseTo(0.5, 9);
    expect(Mercator.x(-180)).toBe(0);
    expect(Mercator.x(180)).toBe(1);
  });

  it("keeps a latitude out of the projection on its edge", () => {
    expect(Number.isFinite(Mercator.y(90))).toBe(true);
  });

  it("finds the point at a distance along a bearing", () => {
    const north = Mercator.destination(48, 2, 0, 111_195);
    const east = Mercator.destination(0, 0, 90, 111_195);

    expect(north.lat).toBeCloseTo(49, 2);
    expect(north.lon).toBeCloseTo(2, 6);
    expect(east.lon).toBeCloseTo(1, 2);
    expect(east.lat).toBeCloseTo(0, 6);
  });
});
