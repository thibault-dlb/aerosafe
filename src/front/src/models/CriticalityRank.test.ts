import { describe, expect, it } from "vitest";

import { CriticalityRank } from "./Alert";

describe("CriticalityRank", () => {
  it("finds the highest level", () => {
    expect(CriticalityRank.highest(["LOW", "HIGH", "MEDIUM"])).toBe("HIGH");
    expect(CriticalityRank.highest(["MEDIUM", "LOW"])).toBe("MEDIUM");
    expect(CriticalityRank.highest(["LOW"])).toBe("LOW");
  });

  it("ignores the alerts without a level", () => {
    expect(CriticalityRank.highest([null, "LOW", null])).toBe("LOW");
  });

  it("has none when there is nothing to compare", () => {
    expect(CriticalityRank.highest([])).toBeNull();
    expect(CriticalityRank.highest([null])).toBeNull();
  });
});
