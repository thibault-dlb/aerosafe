import L from "leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrafficAircraft } from "@/models/Traffic";

import { DeadReckoning } from "./DeadReckoning";
import { MapTheme } from "./MapTheme";
import { Mercator } from "./Mercator";
import { TrafficLayer } from "./TrafficLayer";

const NOW = Date.UTC(2022, 7, 6, 10, 0, 0);
const VIEW = { lat: 48.5, lon: 2.5, zoom: 8, width: 800, height: 600 };

function aircraft(id: string, overrides: Partial<TrafficAircraft> = {}): TrafficAircraft {
  return {
    id,
    name: id.toUpperCase(),
    lat: 48.5,
    lon: 2.5,
    altitude: 10_000,
    heading: 90,
    speed: 230,
    onGround: false,
    contactAt: NOW,
    criticality: null,
    ...overrides,
  };
}

/** A 2D context that counts what it is asked to draw. */
function recorder() {
  const calls: Record<string, number> = {};
  const context = new Proxy(
    {},
    {
      get: (_target, name: string) => () => {
        calls[name] = (calls[name] ?? 0) + 1;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { context, calls };
}

let clock = NOW;
let map: L.Map;
let layer: TrafficLayer;
let events: { picked: (string | null)[]; moved: number };

beforeEach(() => {
  clock = NOW;
  events = { picked: [], moved: 0 };
  const container = document.createElement("div");
  document.body.appendChild(container);
  map = L.map(container, { center: [48.5, 2.5], zoom: 8, zoomAnimation: false });
  vi.spyOn(map, "getSize").mockReturnValue(L.point(800, 600));
  layer = new TrafficLayer(map, () => clock, new MapTheme(), {
    onPick: (id) => events.picked.push(id),
    onUserMove: () => (events.moved += 1),
    reducedMotion: false,
  });
});

afterEach(() => {
  layer.destroy();
  map.remove();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("TrafficLayer", () => {
  it("keeps the aircraft of the latest reports and drops the others", () => {
    layer.update([aircraft("a"), aircraft("b")]);
    layer.update([aircraft("b"), aircraft("c")]);

    expect(layer.count).toBe(2);
    expect(layer.describe("a")).toBeNull();
    expect(layer.describe("c")).not.toBeNull();
  });

  it("carries an aircraft from its report at its heading and speed", () => {
    layer.update([aircraft("a", { heading: 0, speed: 250 })]);
    clock = NOW + 60_000;

    const snapshot = layer.describe("a", 0);

    expect(snapshot?.age).toBe(60_000);
    expect((snapshot?.lat ?? 0) - 48.5).toBeCloseTo(15_000 / 111_195, 3);
    expect(snapshot?.silent).toBe(false);
  });

  it("stops carrying an aircraft nobody has heard for a long time", () => {
    layer.update([aircraft("a")]);
    clock = NOW + 10 * DeadReckoning.SILENT_MS;

    expect(layer.describe("a", 0)?.silent).toBe(true);
  });

  it("blends a new report in over a second instead of jumping", () => {
    layer.update([aircraft("a", { heading: null })], 0);
    clock = NOW + 2_000;
    layer.update([aircraft("a", { heading: null, lon: 2.6, contactAt: clock })], 10_000);

    const atReport = layer.describe("a", 10_000);
    const halfway = layer.describe("a", 10_000 + TrafficLayer.SETTLE_MS / 2);
    const settled = layer.describe("a", 10_000 + TrafficLayer.SETTLE_MS);

    expect(atReport?.lon).toBeCloseTo(2.5, 6);
    expect(halfway?.lon).toBeGreaterThan(2.5);
    expect(halfway?.lon).toBeLessThan(2.6);
    expect(settled?.lon).toBeCloseTo(2.6, 6);
  });

  it("does not blend with reduced motion", () => {
    const still = new TrafficLayer(map, () => clock, new MapTheme(), { reducedMotion: true });
    still.update([aircraft("a", { heading: null })], 0);
    still.update([aircraft("a", { heading: null, lon: 2.6 })], 10_000);

    expect(still.describe("a", 10_000)?.lon).toBeCloseTo(2.6, 6);
    still.destroy();
  });

  it("keeps the followed aircraft when the API no longer lists it", () => {
    layer.update([aircraft("a")]);
    layer.track("a");
    layer.update([]);

    expect(layer.describe("a")).not.toBeNull();

    layer.track(null);
    layer.update([]);

    expect(layer.count).toBe(0);
  });

  it("picks the nearest aircraft within reach of a click", () => {
    layer.update([aircraft("a", { heading: null }), aircraft("b", { heading: null, lon: 2.7 })]);
    const { context } = recorder();
    layer.render(context, VIEW, 1);
    const a = Mercator.toScreen(VIEW, 48.5, 2.5);

    expect(layer.pick(a.x + 5, a.y + 5)).toBe("a");
    expect(layer.pick(a.x + 60, a.y)).toBeNull();
  });

  it("gives the click on the map to the page", () => {
    layer.mount();
    layer.update([aircraft("a", { heading: null })]);
    layer.render(recorder().context, VIEW, 1);
    const a = Mercator.toScreen(VIEW, 48.5, 2.5);

    map.fire("click", { containerPoint: L.point(a.x, a.y) });
    map.fire("click", { containerPoint: L.point(5, 5) });

    expect(events.picked).toEqual(["a", null]);
  });

  it("tells the page when the user moves the map by hand", () => {
    layer.mount();
    layer.update([aircraft("a")]);
    layer.track("a");
    layer.follow(true);

    map.fire("dragstart");

    expect(events.moved).toBe(1);
  });

  it("draws the lines of the next 15 minutes in one stroke for each colour", () => {
    layer.update([aircraft("a"), aircraft("b", { lat: 48.6 }), aircraft("c", { lat: 48.4, altitude: 3000 })]);
    const { context, calls } = recorder();

    layer.render(context, VIEW, 1);

    // Two colours (high and low), a stroke for each, and the diamonds of the ground aircraft.
    expect(calls.lineTo).toBe(3);
    expect(calls.clearRect).toBe(1);
  });

  it("draws no line for an aircraft on the ground, without a heading or lost", () => {
    layer.update([
      aircraft("a", { onGround: true }),
      aircraft("b", { heading: null }),
      aircraft("c", { speed: null }),
      aircraft("d", { contactAt: NOW - 10 * DeadReckoning.SILENT_MS }),
    ]);
    const { context, calls } = recorder();

    layer.render(context, VIEW, 1);

    // Only the diamond of the aircraft on the ground uses lineTo.
    expect(calls.lineTo).toBe(3);
  });

  it("draws the whole flight of the followed aircraft behind it", () => {
    layer.update([aircraft("a")]);
    layer.track("a");
    layer.setTrail([
      { at: NOW - 3_600_000, lat: 48.0, lon: 1.5, altitude: 9000 },
      { at: NOW - 1_800_000, lat: 48.2, lon: 2.0, altitude: 10_000 },
    ]);
    const { context, calls } = recorder();

    layer.render(context, VIEW, 1);

    expect(calls.setLineDash).toBeGreaterThanOrEqual(2);
    expect(calls.lineTo).toBeGreaterThanOrEqual(5);
  });

  it("forgets the trail when nothing is followed any more", () => {
    layer.update([aircraft("a")]);
    layer.track("a");
    layer.setTrail([{ at: NOW, lat: 48, lon: 1.5, altitude: null }, { at: NOW, lat: 48.1, lon: 1.6, altitude: null }]);
    layer.track(null);
    const { context, calls } = recorder();

    layer.render(context, VIEW, 1);

    expect(calls.setLineDash ?? 0).toBe(0);
  });

  it("colours an aircraft with an alert after its criticality", () => {
    const colors = { ...new MapTheme().colors(), alertHigh: "#ff0000" };
    layer.setColors(colors);
    layer.update([aircraft("a", { criticality: "HIGH" })]);
    const { context, calls } = recorder();

    layer.render(context, VIEW, 1);

    expect(calls.arc).toBeGreaterThanOrEqual(2);
  });

  it("starts and stops its loop", () => {
    layer.mount();
    layer.destroy();

    expect(layer.count).toBe(0);
  });
});
