import { describe, expect, it } from "vitest";

import { Formatter } from "./Formatter";

describe("Formatter", () => {
  it("shows a number with its unit, or a dash when missing", () => {
    expect(Formatter.number(10000.4, "m")).toBe("10000 m");
    expect(Formatter.number(230.25, "m/s", 1)).toBe("230.3 m/s");
    expect(Formatter.number(null, "m")).toBe("–");
  });

  it("rounds a value to one decimal without a trailing zero", () => {
    expect(Formatter.rounded(420, "s")).toBe("420 s");
    expect(Formatter.rounded(5.5, "°/s")).toBe("5.5 °/s");
    expect(Formatter.rounded(0.3333, "m/s²")).toBe("0.3 m/s²");
    expect(Formatter.rounded(null, "s")).toBe("–");
  });

  it("shows altitudes, speeds and distances in the unit system chosen", () => {
    expect(Formatter.altitude(10400)).toBe("10400 m");
    expect(Formatter.altitude(10400, "aeronautical")).toBe("34121 ft");
    expect(Formatter.speed(231)).toBe("231 m/s");
    expect(Formatter.speed(231, "aeronautical")).toBe("449 kt");
    expect(Formatter.distance(548.3)).toBe("548.3 km");
    expect(Formatter.distance(548.3, "aeronautical")).toBe("296.1 NM");
    expect(Formatter.altitude(null, "aeronautical")).toBe("–");
    expect(Formatter.speed(null)).toBe("–");
    expect(Formatter.distance(null)).toBe("–");
  });

  it("shows the value of a rule, converting only the vertical speed", () => {
    expect(Formatter.ruleValue(42, "m/s")).toBe("42 m/s");
    expect(Formatter.ruleValue(42, "m/s", "aeronautical")).toBe("8267.7 ft/min");
    expect(Formatter.ruleValue(412, "s", "aeronautical")).toBe("412 s");
    expect(Formatter.ruleValue(null, "s")).toBe("–");
  });

  it("shows a date, or a dash when missing", () => {
    expect(Formatter.date(null)).toBe("–");
    expect(Formatter.date(new Date("2026-11-09T10:00:00Z"))).not.toBe("–");
  });

  it.each([
    [45, "45 s"],
    [60, "1 min 00 s"],
    [125, "2 min 05 s"],
    [3900, "1 h 05 min"],
  ])("shows %i seconds as %s", (seconds, text) => {
    expect(Formatter.duration(seconds)).toBe(text);
  });
});
