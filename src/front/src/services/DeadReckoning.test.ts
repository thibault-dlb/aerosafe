import { describe, expect, it } from "vitest";

import { DeadReckoning } from "./DeadReckoning";
import { Mercator } from "./Mercator";

describe("DeadReckoning", () => {
  it("keeps an aircraft without a heading, without a speed or on the ground where it is", () => {
    for (const motion of [
      DeadReckoning.motion(48, 2, null, 200, false, 0),
      DeadReckoning.motion(48, 2, 90, null, false, 0),
      DeadReckoning.motion(48, 2, 90, 0, false, 0),
      DeadReckoning.motion(48, 2, 90, 200, true, 0),
    ]) {
      expect(DeadReckoning.moving(motion)).toBe(false);
      expect(DeadReckoning.at(motion, 60_000).x).toBe(Mercator.x(2));
    }
  });

  it("carries an aircraft north at its speed", () => {
    const motion = DeadReckoning.motion(48, 2, 0, 250, false, 1_000);
    const later = DeadReckoning.at(motion, 61_000);
    const place = { lat: Mercator.lat(later.y), lon: Mercator.lon(later.x) };

    // 250 m/s for 60 s is 15 km, 0.135 degree of latitude.
    expect(place.lat - 48).toBeCloseTo(15_000 / 111_195, 3);
    expect(place.lon).toBeCloseTo(2, 6);
    expect(later.age).toBe(60_000);
    expect(later.silent).toBe(false);
  });

  it("carries an aircraft east, where a degree of longitude is shorter", () => {
    const motion = DeadReckoning.motion(60, 2, 90, 250, false, 0);
    const later = DeadReckoning.at(motion, 60_000);

    // 15 km at latitude 60 is twice the degrees of longitude it is at the equator.
    expect(Mercator.lon(later.x) - 2).toBeCloseTo(15_000 / (111_195 * Math.cos((60 * Math.PI) / 180)), 2);
    expect(Mercator.lat(later.y)).toBeCloseTo(60, 2);
  });

  it("agrees with the great circle for a heading kept over a short way", () => {
    const motion = DeadReckoning.motion(48.5, 2.5, 45, 230, false, 0);
    const later = DeadReckoning.at(motion, 60_000);
    const expected = Mercator.destination(48.5, 2.5, 45, 230 * 60);

    expect(Mercator.lat(later.y)).toBeCloseTo(expected.lat, 3);
    expect(Mercator.lon(later.x)).toBeCloseTo(expected.lon, 3);
  });

  it("stops carrying a report that is too old", () => {
    const motion = DeadReckoning.motion(48, 2, 0, 250, false, 0);
    const stopped = DeadReckoning.at(motion, DeadReckoning.SILENT_MS);
    const later = DeadReckoning.at(motion, 10 * DeadReckoning.SILENT_MS);

    expect(stopped.silent).toBe(false);
    expect(later.silent).toBe(true);
    expect(later.y).toBe(stopped.y);
    expect(later.age).toBe(10 * DeadReckoning.SILENT_MS);
  });

  it("never goes back before the report", () => {
    const motion = DeadReckoning.motion(48, 2, 0, 250, false, 10_000);

    expect(DeadReckoning.at(motion, 0).age).toBe(0);
    expect(DeadReckoning.at(motion, 0).y).toBe(Mercator.y(48));
  });
});
