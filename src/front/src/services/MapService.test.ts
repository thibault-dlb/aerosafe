import { afterEach, describe, expect, it, vi } from "vitest";

import { ATTRIBUTION, MapService } from "./MapService";
import { MapTheme } from "./MapTheme";

const PARIS = { latitude: 48.85, longitude: 2.35, label: "D-AIBD" };
const LYON = { latitude: 45.76, longitude: 4.83 };

let service: MapService;

function mounted(): { service: MapService; container: HTMLElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  service = new MapService();
  service.mount(container);
  return { service, container };
}

afterEach(() => {
  service?.destroy();
  document.body.innerHTML = "";
});

describe("MapService", () => {
  it("mounts a Leaflet map with the OpenStreetMap and OpenSky credits", () => {
    const { container } = mounted();

    expect(service.mounted).toBe(true);
    expect(container.classList.contains("leaflet-container")).toBe(true);
    expect(ATTRIBUTION).toContain("OpenStreetMap");
    expect(ATTRIBUTION).toContain("OpenSky");
  });

  it("refuses to be mounted twice", () => {
    const { container } = mounted();

    expect(() => service.mount(container)).toThrow("already mounted");
  });

  it("refuses to draw before it is mounted", () => {
    service = new MapService();

    expect(() => service.showAircraft([PARIS])).toThrow("not mounted");
    expect(() => service.showTrajectory([PARIS])).toThrow("not mounted");
  });

  it("replaces the aircraft markers on each call", () => {
    mounted();

    service.showAircraft([PARIS, LYON]);
    service.showAircraft([PARIS]);

    expect(service.counts.aircraft).toBe(1);
  });

  it("draws a trajectory as one line", () => {
    mounted();

    service.showTrajectory([PARIS, LYON]);

    expect(service.counts.segments).toBe(1);
  });

  it("draws each segment of a partial trajectory apart and skips empty ones", () => {
    mounted();

    service.showSegments([[PARIS, LYON], [], [LYON]]);

    expect(service.counts.segments).toBe(2);
  });

  it("accepts nothing to draw", () => {
    mounted();

    service.showAircraft([]);
    service.showSegments([]);

    expect(service.counts).toEqual({ aircraft: 0, segments: 0 });
  });

  it("shades the markers by altitude", () => {
    mounted();

    service.showAircraft([
      { ...PARIS, altitude: 1000 },
      { ...PARIS, altitude: 7000 },
      { ...PARIS, altitude: 11000 },
      PARIS,
    ]);

    const [low, mid, high, unknown] = service.aircraftColors;
    expect(new Set([low, mid, high]).size).toBe(3);
    expect(unknown).toBe(mid);
  });

  it("draws again with the new colours when the theme changes", async () => {
    const colors = { low: "#111111", mid: "#222222", high: "#333333", selected: "#444444" };
    const theme = new MapTheme();
    const read = vi.spyOn(theme, "colors").mockReturnValue(colors);
    const container = document.createElement("div");
    document.body.appendChild(container);
    service = new MapService(theme);
    service.mount(container);
    service.showAircraft([PARIS]);
    expect(service.aircraftColors).toEqual(["#222222"]);

    read.mockReturnValue({ ...colors, mid: "#abcdef" });
    document.documentElement.setAttribute("data-theme", "light");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.aircraftColors).toEqual(["#abcdef"]);
    document.documentElement.removeAttribute("data-theme");
  });

  it("draws again when the system theme changes", () => {
    let changed: (() => void) | undefined;
    const media = {
      addEventListener: (_: string, listener: () => void) => (changed = listener),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", () => media);
    const theme = new MapTheme();
    const colors = { low: "#111111", mid: "#222222", high: "#333333", selected: "#444444" };
    const read = vi.spyOn(theme, "colors").mockReturnValue(colors);
    const container = document.createElement("div");
    document.body.appendChild(container);
    service = new MapService(theme);
    service.mount(container);
    service.showAircraft([PARIS]);

    read.mockReturnValue({ ...colors, mid: "#abcdef" });
    changed?.();

    expect(service.aircraftColors).toEqual(["#abcdef"]);
    service.destroy();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", changed);
    vi.unstubAllGlobals();
  });

  it("stops watching the theme once destroyed", async () => {
    mounted();
    service.showAircraft([PARIS]);
    service.destroy();

    document.documentElement.setAttribute("data-theme", "light");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.counts.aircraft).toBe(1);
    document.documentElement.removeAttribute("data-theme");
  });

  it("can be destroyed more than once", () => {
    mounted();

    service.destroy();
    service.destroy();

    expect(service.mounted).toBe(false);
  });
});
