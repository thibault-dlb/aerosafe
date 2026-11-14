import * as L from "leaflet";
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

  it("turns the silhouette with the heading and draws an aircraft on the ground as a diamond", () => {
    mounted();

    service.showAircraft([{ ...PARIS, heading: 90 }, { ...PARIS, onGround: true }]);

    const markers = document.querySelectorAll(".aircraftMarker");
    expect(markers).toHaveLength(2);
    expect(markers[0].innerHTML).toContain("rotate(90)");
    expect(markers[1].innerHTML).toContain("M0 -6L6 0L0 6L-6 0Z");
  });

  it("colours the marker of an aircraft with an alert and makes it pulse", () => {
    mounted();

    service.showAircraft([
      { ...PARIS, criticality: "HIGH" },
      { ...PARIS, criticality: "MEDIUM" },
      { ...PARIS, criticality: "LOW" },
      { ...PARIS, altitude: 11000 },
    ]);

    const [high, medium, low, none] = service.aircraftColors;
    expect(high).toBe(MapTheme.FALLBACK.alertHigh);
    expect(medium).toBe(MapTheme.FALLBACK.alertMedium);
    expect(low).toBe(MapTheme.FALLBACK.alertLow);
    expect(none).toBe(MapTheme.FALLBACK.high);
    expect(document.querySelectorAll(".aircraftMarker .halo")).toHaveLength(3);
  });

  it("rings the selected aircraft and names every marker for assistive technologies", () => {
    mounted();

    service.showAircraft([{ ...PARIS, selected: true }, LYON]);

    const [first, second] = document.querySelectorAll(".aircraftMarker");
    expect(first.innerHTML).toContain("stroke-dasharray");
    expect(second.innerHTML).not.toContain("stroke-dasharray");
    expect(document.querySelector('img[title="D-AIBD"], .leaflet-marker-icon[title="D-AIBD"]')).not.toBeNull();
  });

  it("draws and removes the search area", () => {
    mounted();
    expect(service.hasArea).toBe(false);

    service.showArea({ south: 48, west: 1.5, north: 49, east: 3 });
    expect(service.hasArea).toBe(true);

    service.showArea(null);
    expect(service.hasArea).toBe(false);
  });

  it("refuses to draw an area before it is mounted", () => {
    service = new MapService();

    expect(() => service.showArea(null)).toThrow("not mounted");
    expect(() => service.startAreaSelection(() => undefined)).toThrow("not mounted");
  });

  describe("when the user draws an area", () => {
    function drag(from: L.LatLngTuple, to: L.LatLngTuple, mapOf: L.Map) {
      mapOf.fire("mousedown", { latlng: L.latLng(from) });
      mapOf.fire("mousemove", { latlng: L.latLng(to) });
      mapOf.fire("mouseup", { latlng: L.latLng(to) });
    }

    function leaflet(): L.Map {
      return (service as unknown as { map: L.Map }).map;
    }

    it("reports the rectangle between the two corners and keeps it drawn", () => {
      mounted();
      const onDrawn = vi.fn();
      service.startAreaSelection(onDrawn);

      drag([49, 3], [48, 1.5], leaflet());

      expect(onDrawn).toHaveBeenCalledWith({ south: 48, west: 1.5, north: 49, east: 3 });
      expect(service.hasArea).toBe(true);
    });

    it("does not let the map pan while the user draws, and lets it again after", () => {
      mounted();
      service.startAreaSelection(() => undefined);
      const map = leaflet();

      map.fire("mousedown", { latlng: L.latLng([48, 2]) });
      expect(map.dragging.enabled()).toBe(false);
      map.fire("mouseup", { latlng: L.latLng([49, 3]) });

      expect(map.dragging.enabled()).toBe(true);
    });

    it("ignores a drag that encloses nothing, and a drag that leaves the map", () => {
      mounted();
      const onDrawn = vi.fn();
      service.startAreaSelection(onDrawn);
      const map = leaflet();

      drag([48, 2], [48, 2], map);
      map.fire("mousedown", { latlng: L.latLng([48, 2]) });
      map.fire("mousemove", { latlng: L.latLng([49, 3]) });
      map.fire("mouseout");
      map.fire("mouseup", { latlng: L.latLng([49, 3]) });

      expect(onDrawn).not.toHaveBeenCalled();
      expect(service.hasArea).toBe(false);
      expect(map.dragging.enabled()).toBe(true);
    });

    it("ignores the mouse moving or being released without a press", () => {
      mounted();
      const onDrawn = vi.fn();
      service.startAreaSelection(onDrawn);
      const map = leaflet();

      map.fire("mousemove", { latlng: L.latLng([48, 2]) });
      map.fire("mouseup", { latlng: L.latLng([49, 3]) });

      expect(onDrawn).not.toHaveBeenCalled();
    });

    it("stops listening once the selection is stopped or the map destroyed", () => {
      const { container } = mounted();
      const onDrawn = vi.fn();
      service.startAreaSelection(onDrawn);
      expect(container.style.cursor).toBe("crosshair");
      const map = leaflet();

      service.stopAreaSelection();
      drag([48, 2], [49, 3], map);

      expect(onDrawn).not.toHaveBeenCalled();
      expect(container.style.cursor).toBe("");
      service.stopAreaSelection();
    });

    it("starts again from nothing when asked twice", () => {
      mounted();
      const first = vi.fn();
      const second = vi.fn();
      service.startAreaSelection(first);
      service.startAreaSelection(second);

      drag([48, 2], [49, 3], leaflet());

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  it("draws again with the new colours when the theme changes", async () => {
    const colors = { ...MapTheme.FALLBACK, low: "#111111", mid: "#222222", high: "#333333", selected: "#444444" };
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
    const colors = { ...MapTheme.FALLBACK, low: "#111111", mid: "#222222", high: "#333333", selected: "#444444" };
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

  describe("when the room it has changes", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    function stubObserver() {
      const observer = { observe: vi.fn(), disconnect: vi.fn() };
      let notify: () => void = () => undefined;
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            notify = callback;
          }
          observe = observer.observe;
          disconnect = observer.disconnect;
        },
      );
      return { observer, notify: () => notify() };
    }

    it("measures itself again, so the side bar folding leaves no blank strip", () => {
      const resize = stubObserver();
      const invalidate = vi.spyOn(L.Map.prototype, "invalidateSize");

      const { container } = mounted();
      expect(resize.observer.observe).toHaveBeenCalledWith(container);
      invalidate.mockClear();
      resize.notify();

      expect(invalidate).toHaveBeenCalledOnce();
    });

    it("stops watching once destroyed", () => {
      const resize = stubObserver();
      mounted();

      service.destroy();

      expect(resize.observer.disconnect).toHaveBeenCalled();
    });

    it("does not fail where the browser cannot watch sizes", () => {
      vi.stubGlobal("ResizeObserver", undefined);

      expect(() => mounted()).not.toThrow();
    });
  });
});
