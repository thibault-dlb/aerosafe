import { describe, expect, it } from "vitest";

import { Units } from "./Units";

describe("Units", () => {
  it("keeps the metric values as they are", () => {
    expect(Units.altitude(10400, "metric")).toEqual({ value: 10400, unit: "m" });
    expect(Units.speed(231, "metric")).toEqual({ value: 231, unit: "m/s" });
    expect(Units.distance(548.3, "metric")).toEqual({ value: 548.3, unit: "km" });
  });

  it("converts to feet, knots and nautical miles", () => {
    expect(Units.altitude(10400, "aeronautical").value).toBeCloseTo(34120.7, 1);
    expect(Units.altitude(10400, "aeronautical").unit).toBe("ft");
    expect(Units.speed(231, "aeronautical").value).toBeCloseTo(449.0, 1);
    expect(Units.speed(231, "aeronautical").unit).toBe("kt");
    expect(Units.distance(548.3, "aeronautical").value).toBeCloseTo(296.1, 1);
    expect(Units.distance(548.3, "aeronautical").unit).toBe("NM");
  });

  it("shows the vertical speed of R3 in feet per minute, and nothing else of the rules", () => {
    const climb = Units.ruleValue(25, "m/s", "aeronautical");
    expect(climb.value).toBeCloseTo(4921.3, 1);
    expect(climb.unit).toBe("ft/min");
    expect(Units.ruleValue(25, "m/s", "metric")).toEqual({ value: 25, unit: "m/s" });
    expect(Units.ruleValue(300, "s", "aeronautical")).toEqual({ value: 300, unit: "s" });
    expect(Units.ruleValue(2, "m/s²", "aeronautical")).toEqual({ value: 2, unit: "m/s²" });
    expect(Units.ruleValue(3, "°/s", "aeronautical")).toEqual({ value: 3, unit: "°/s" });
  });
});
