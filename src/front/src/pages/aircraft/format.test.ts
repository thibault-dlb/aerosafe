import { describe, expect, it } from "vitest";

import { formatDate, formatDuration, formatNumber } from "./format";

describe("format", () => {
  it("shows a number with its unit, or a dash when missing", () => {
    expect(formatNumber(10000.4, "m")).toBe("10000 m");
    expect(formatNumber(230.25, "m/s", 1)).toBe("230.3 m/s");
    expect(formatNumber(null, "m")).toBe("–");
  });

  it("shows a date, or a dash when missing", () => {
    expect(formatDate(null)).toBe("–");
    expect(formatDate(new Date("2026-11-09T10:00:00Z"))).not.toBe("–");
  });

  it.each([
    [45, "45 s"],
    [60, "1 min 00 s"],
    [125, "2 min 05 s"],
    [3900, "1 h 05 min"],
  ])("shows %i seconds as %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
