import { describe, expect, it } from "vitest";

import { MapTheme } from "./MapTheme";

const COLORS = { low: "#111111", mid: "#222222", high: "#333333", selected: "#444444" };

describe("MapTheme", () => {
  it("reads the colours from the tokens of the page", () => {
    const root = document.createElement("div");
    root.style.setProperty("--map-aircraft-low", "#aa0000");
    root.style.setProperty("--map-aircraft-mid", "#00aa00");
    root.style.setProperty("--map-aircraft-high", "#0000aa");
    root.style.setProperty("--map-selected", "#aaaa00");
    document.body.appendChild(root);

    expect(new MapTheme(root).colors()).toEqual({
      low: "#aa0000",
      mid: "#00aa00",
      high: "#0000aa",
      selected: "#aaaa00",
    });
    root.remove();
  });

  it("falls back on the dark theme when the tokens are missing", () => {
    expect(new MapTheme(document.createElement("div")).colors()).toEqual(MapTheme.FALLBACK);
  });

  it.each([
    [0, "low"],
    [4571, "low"],
    [4572, "mid"],
    [9144, "mid"],
    [9145, "high"],
    [11000, "high"],
    [null, "mid"],
    [undefined, "mid"],
  ] as const)("colours an aircraft at %s m with the %s shade", (altitude, shade) => {
    expect(new MapTheme().aircraftColor(altitude, COLORS)).toBe(COLORS[shade]);
  });

  it("reads the colours of the theme when none are given", () => {
    expect(new MapTheme(document.createElement("div")).aircraftColor(10000)).toBe(MapTheme.FALLBACK.high);
  });
});
