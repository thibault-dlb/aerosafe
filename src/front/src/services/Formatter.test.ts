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
