import { describe, expect, it } from "vitest";

import { StatusLevels } from "./StatusLevel";

describe("StatusLevels", () => {
  it.each([
    ["HIGH", "danger"],
    ["MEDIUM", "warning"],
    ["LOW", "normal"],
    [null, "normal"],
    [undefined, "normal"],
  ])("maps %s to %s", (criticality, level) => {
    expect(StatusLevels.fromCriticality(criticality)).toBe(level);
  });
});
