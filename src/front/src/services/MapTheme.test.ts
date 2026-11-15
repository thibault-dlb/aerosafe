import { describe, expect, it } from "vitest";

import { MapTheme } from "./MapTheme";

const COLORS = { ...MapTheme.FALLBACK, low: "#111111", mid: "#222222", high: "#333333", selected: "#444444" };

describe("MapTheme", () => {
  it("reads the colours from the tokens of the page", () => {
    const root = document.createElement("div");
    const tokens: Record<string, string> = {
      "--basemap-aircraft-low": "#aa0000",
      "--basemap-aircraft-mid": "#00aa00",
      "--basemap-aircraft-high": "#0000aa",
      "--basemap-selected": "#aaaa00",
      "--basemap-bg": "#010101",
      "--basemap-alert-high": "#ff0001",
      "--basemap-alert-medium": "#ff0002",
      "--basemap-alert-low": "#ff0003",
      "--basemap-land": "#020202",
      "--basemap-urban": "#030303",
      "--basemap-border": "#040404",
      "--basemap-water": "#050505",
      "--basemap-grid": "#060606",
      "--basemap-rings": "#070707",
      "--basemap-text": "#080808",
    };
    for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
    document.body.appendChild(root);

    expect(new MapTheme(root).colors()).toEqual({
      low: "#aa0000",
      mid: "#00aa00",
      high: "#0000aa",
      selected: "#aaaa00",
      outline: "#010101",
      alertHigh: "#ff0001",
      alertMedium: "#ff0002",
      alertLow: "#ff0003",
      land: "#020202",
      urban: "#030303",
      border: "#040404",
      water: "#050505",
      grid: "#060606",
      rings: "#070707",
      text: "#080808",
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

  it.each([
    ["HIGH", "alertHigh"],
    ["MEDIUM", "alertMedium"],
    ["LOW", "alertLow"],
  ] as const)("colours an alert of %s criticality with %s", (criticality, key) => {
    expect(new MapTheme().alertColor(criticality, COLORS)).toBe(COLORS[key]);
  });

  it("has no alert colour without a criticality", () => {
    expect(new MapTheme().alertColor(null, COLORS)).toBeNull();
    expect(new MapTheme().alertColor(undefined, COLORS)).toBeNull();
  });

  it("colours a marker with its alert first, and with its altitude otherwise", () => {
    const theme = new MapTheme();

    expect(theme.markerColor({ altitude: 11000, criticality: "HIGH" }, COLORS)).toBe(COLORS.alertHigh);
    expect(theme.markerColor({ altitude: 11000 }, COLORS)).toBe(COLORS.high);
    expect(theme.markerColor({}, COLORS)).toBe(COLORS.mid);
  });

  it("reads the colours of the theme when none are given", () => {
    expect(new MapTheme(document.createElement("div")).aircraftColor(10000)).toBe(MapTheme.FALLBACK.high);
  });
});
