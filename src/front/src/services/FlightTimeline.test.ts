import { describe, expect, it } from "vitest";

import { FlightRoute } from "./FlightRoute";
import { FlightTimeline } from "./FlightTimeline";

const CENTER = { x: 500, y: 500 };
const ROUTE = new FlightRoute([
  { x: 300, y: 200 },
  { x: 450, y: 450 },
  { x: 700, y: 800 },
]);
const TIMELINE = new FlightTimeline(ROUTE, CENTER);

/** Scroll position at which the aircraft has flown this fraction of its route. */
function at(flight: number): number {
  return FlightTimeline.FLIGHT_START + flight * (FlightTimeline.FLIGHT_END - FlightTimeline.FLIGHT_START);
}

describe("FlightTimeline helpers", () => {
  it("clamps to 0 and 1", () => {
    expect(FlightTimeline.clamp(-2)).toBe(0);
    expect(FlightTimeline.clamp(0.4)).toBe(0.4);
    expect(FlightTimeline.clamp(9)).toBe(1);
  });

  it("ramps from 0 to 1 between two positions", () => {
    expect(FlightTimeline.ramp(0.1, 0.2, 0.4)).toBe(0);
    expect(FlightTimeline.ramp(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    expect(FlightTimeline.ramp(0.9, 0.2, 0.4)).toBe(1);
  });

  it("eases with a soft start and end", () => {
    expect(FlightTimeline.ease(0.2, 0.2, 0.4)).toBe(0);
    expect(FlightTimeline.ease(0.3, 0.2, 0.4)).toBeCloseTo(0.5);
    expect(FlightTimeline.ease(0.4, 0.2, 0.4)).toBe(1);
    expect(FlightTimeline.ease(0.22, 0.2, 0.4)).toBeLessThan(FlightTimeline.ramp(0.22, 0.2, 0.4));
  });
});

describe("FlightTimeline", () => {
  it("opens on the title, before any flight", () => {
    const frame = TIMELINE.frame(0);

    expect(frame.introOpacity).toBe(1);
    expect(frame.flight).toBe(0);
    expect(frame.track).toEqual([]);
    expect(frame.alertTrack).toEqual([]);
    expect(frame.alert).toBe(false);
    expect(frame.hudOpacity).toBe(0);
    expect(frame.camera).toEqual({ ...CENTER, zoom: 1 });
  });

  it("ends with the alert, the aircraft at the arrival and the camera back on the country", () => {
    const frame = TIMELINE.frame(1);

    expect(frame.introOpacity).toBe(0);
    expect(frame.flight).toBe(1);
    expect(frame.alert).toBe(true);
    expect(frame.alertOpacity).toBe(1);
    expect(frame.plane.x).toBeCloseTo(700, 3);
    expect(frame.plane.y).toBeCloseTo(800, 3);
    expect(frame.camera).toEqual({ ...CENTER, zoom: 1 });
  });

  it("keeps a position outside 0 to 1 at its ends", () => {
    expect(TIMELINE.frame(-5)).toEqual(TIMELINE.frame(0));
    expect(TIMELINE.frame(5)).toEqual(TIMELINE.frame(1));
  });

  it("follows the aircraft with the camera in the middle of the flight", () => {
    const frame = TIMELINE.frame(at(0.5));

    expect(frame.camera.zoom).toBeCloseTo(FlightTimeline.MAX_ZOOM, 3);
    expect(frame.camera.x).toBeCloseTo(frame.plane.x, 3);
    expect(frame.camera.y).toBeCloseTo(frame.plane.y, 3);
  });

  it("flies the route as the scroll advances", () => {
    const early = TIMELINE.frame(at(0.2));
    const late = TIMELINE.frame(at(0.4));

    expect(late.flight).toBeGreaterThan(early.flight);
    expect(late.plane.y).toBeGreaterThan(early.plane.y);
    expect(late.track.length).toBeGreaterThan(early.track.length);
  });

  it("raises the alert only once the altitude has started to drop", () => {
    expect(TIMELINE.frame(at(0.55)).alert).toBe(false);
    expect(TIMELINE.frame(at(0.7)).alert).toBe(true);
    expect(TIMELINE.frame(at(0.55)).alertOpacity).toBe(0);
  });

  it("draws the track in the alert colour only after the drop starts", () => {
    expect(TIMELINE.frame(at(FlightTimeline.DROP_START - 0.05)).alertTrack).toEqual([]);
    expect(TIMELINE.frame(at(FlightTimeline.DROP_END + 0.1)).alertTrack.length).toBeGreaterThan(1);
  });

  it("shows the title captions one after the other", () => {
    const tracking = TIMELINE.frame(0.4);
    const detecting = TIMELINE.frame(0.72);

    expect(tracking.trackCaptionOpacity).toBe(1);
    expect(tracking.detectCaptionOpacity).toBe(0);
    expect(detecting.trackCaptionOpacity).toBe(0);
    expect(detecting.detectCaptionOpacity).toBe(1);
  });

  it("hides the scroll hint once the visitor scrolls", () => {
    expect(TIMELINE.frame(0).hintOpacity).toBe(1);
    expect(TIMELINE.frame(0.2).hintOpacity).toBe(0);
  });
});

describe("FlightTimeline readings", () => {
  it("climbs to the cruise altitude, drops, then descends to the arrival", () => {
    expect(TIMELINE.altitude(0)).toBe(0);
    expect(TIMELINE.altitude(FlightTimeline.DROP_START)).toBeCloseTo(FlightTimeline.CRUISE_ALTITUDE, 3);
    expect(TIMELINE.altitude(FlightTimeline.DROP_END)).toBeCloseTo(FlightTimeline.DROPPED_ALTITUDE, 3);
    expect(TIMELINE.altitude(1)).toBeCloseTo(FlightTimeline.FINAL_ALTITUDE, 3);
  });

  it("falls steadily during the drop", () => {
    const middle = (FlightTimeline.DROP_START + FlightTimeline.DROP_END) / 2;

    expect(TIMELINE.altitude(middle)).toBeLessThan(TIMELINE.altitude(FlightTimeline.DROP_START));
    expect(TIMELINE.altitude(middle)).toBeGreaterThan(TIMELINE.altitude(FlightTimeline.DROP_END));
  });

  it("drops faster than rule R3 allows, and only then", () => {
    const middle = (FlightTimeline.DROP_START + FlightTimeline.DROP_END) / 2;

    expect(Math.abs(FlightTimeline.DROP_RATE)).toBeGreaterThan(FlightTimeline.R3_THRESHOLD);
    expect(TIMELINE.verticalRate(middle)).toBeCloseTo(FlightTimeline.DROP_RATE, 3);
    for (const flight of [0, 0.1, 0.3, 0.5, 0.9, 1]) {
      expect(Math.abs(TIMELINE.verticalRate(flight))).toBeLessThan(FlightTimeline.R3_THRESHOLD);
    }
  });

  it("gives a ground speed that is never negative", () => {
    for (let step = 0; step <= 20; step += 1) {
      expect(TIMELINE.speed(step / 20)).toBeGreaterThan(0);
    }
  });
});
