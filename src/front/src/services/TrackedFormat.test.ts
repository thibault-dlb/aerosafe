import { describe, expect, it } from "vitest";

import { TrackedFormat } from "./TrackedFormat";

describe("TrackedFormat", () => {
  it("writes a place with its hemispheres", () => {
    expect(TrackedFormat.coordinates(48.8534, 2.3488)).toBe("48.8534° N  2.3488° E");
    expect(TrackedFormat.coordinates(-33.9, -70.65)).toBe("33.9000° S  70.6500° W");
  });

  it("draws the profile from the first point to the last, the highest at the top", () => {
    const profile = TrackedFormat.profile(
      [
        { at: 0, lat: 0, lon: 0, altitude: 0 },
        { at: 1000, lat: 0, lon: 0, altitude: 5000 },
        { at: 2000, lat: 0, lon: 0, altitude: 10_000 },
      ],
      300,
      64,
    );

    expect(profile?.peak).toBe(10_000);
    expect(profile?.line).toBe("0.0,60.0 150.0,32.0 300.0,4.0");
  });

  it("keeps a floor of 1 000 metres and ignores the points without altitude", () => {
    const profile = TrackedFormat.profile(
      [
        { at: 0, lat: 0, lon: 0, altitude: 100 },
        { at: 500, lat: 0, lon: 0, altitude: null },
        { at: 1000, lat: 0, lon: 0, altitude: 100 },
      ],
      100,
      60,
    );

    expect(profile?.peak).toBe(1000);
  });

  it("has no profile with fewer than two altitudes", () => {
    expect(TrackedFormat.profile([], 100, 60)).toBeNull();
    expect(TrackedFormat.profile([{ at: 0, lat: 0, lon: 0, altitude: 10 }], 100, 60)).toBeNull();
  });
});
