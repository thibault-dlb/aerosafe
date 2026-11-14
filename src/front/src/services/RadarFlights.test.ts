import { describe, expect, it } from "vitest";

import { RadarFlights } from "./RadarFlights";

describe("RadarFlights", () => {
  it("turns the beam once every nine seconds", () => {
    expect(RadarFlights.frame(0).beamDegrees).toBe(0);
    expect(RadarFlights.frame(4.5).beamDegrees).toBeCloseTo(180);
    expect(RadarFlights.frame(9).beamDegrees).toBeCloseTo(0);
    expect(RadarFlights.frame(11.25).beamDegrees).toBeCloseTo(90);
  });

  it("draws every flight, with its own callsign", () => {
    const callsigns = RadarFlights.frame(0).planes.map((plane) => plane.callsign);

    expect(callsigns).toEqual(RadarFlights.FLIGHTS.map((flight) => flight.callsign));
    expect(new Set(callsigns).size).toBe(callsigns.length);
  });

  it("moves each aircraft along its route", () => {
    const early = RadarFlights.frame(10).planes[0];
    const later = RadarFlights.frame(20).planes[0];

    expect(later.x).not.toBeCloseTo(early.x);
    // ASF2041 flies south east, from Paris to Nice: heading between south and east.
    expect(early.heading).toBeGreaterThan(90);
    expect(early.heading).toBeLessThan(180);
  });

  it("starts a flight again once it has landed", () => {
    const flight = RadarFlights.FLIGHTS[0];
    const lap = flight.seconds;

    const first = RadarFlights.frame(5).planes[0];
    const next = RadarFlights.frame(5 + lap).planes[0];

    expect(next.x).toBeCloseTo(first.x);
    expect(next.y).toBeCloseTo(first.y);
  });

  it("fades an aircraft in at the start of its flight and out at the end", () => {
    // ASF913 starts at 2 % of its flight at time 0: nearly invisible.
    expect(RadarFlights.frame(0).planes[5].opacity).toBeLessThan(0.3);
    const fullFlight = RadarFlights.FLIGHTS[5].seconds;
    const ending = RadarFlights.frame(fullFlight * 0.97).planes[5];
    expect(ending.opacity).toBeLessThan(0.4);
  });

  it("lights an aircraft when the beam has just passed it, and dims it afterwards", () => {
    const seconds = (swept: number) => (swept / 360) * RadarFlights.BEAM_SECONDS;

    const frames = Array.from({ length: 90 }, (_, index) => RadarFlights.frame(12.4 + seconds(index * 4)).planes[0]);
    const brightest = Math.max(...frames.map((frame) => frame.opacity));
    const dimmest = Math.min(...frames.map((frame) => frame.opacity));

    expect(brightest).toBeGreaterThan(dimmest + 0.2);
    expect(Math.max(...frames.map((frame) => frame.echoOpacity))).toBeGreaterThan(0);
  });

  it("gives a short line ahead of each aircraft, along its route", () => {
    const plane = RadarFlights.frame(0).planes[0];

    expect(Math.hypot(plane.leadX, plane.leadY)).toBeGreaterThan(0);
    expect(Math.atan2(plane.leadX, -plane.leadY) * (180 / Math.PI)).toBeCloseTo(plane.heading);
  });

  it("freezes on a readable instant when the animation is off", () => {
    const still = RadarFlights.frame(RadarFlights.STILL_SECONDS);

    expect(still.planes.some((plane) => plane.opacity > 0.4)).toBe(true);
  });
});
