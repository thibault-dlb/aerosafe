import { afterEach, describe, expect, it } from "vitest";

import { ATTRIBUTION, MapService } from "./MapService";

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

  it("can be destroyed more than once", () => {
    mounted();

    service.destroy();
    service.destroy();

    expect(service.mounted).toBe(false);
  });
});
