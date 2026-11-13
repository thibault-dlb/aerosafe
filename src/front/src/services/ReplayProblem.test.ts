import { describe, expect, it } from "vitest";

import { ApiError } from "@/services/ApiClient";

import { ReplayProblems } from "./ReplayProblem";

describe("ReplayProblems", () => {
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [409, "invalid"],
    [422, "invalid"],
    [500, "failed"],
  ] as const)("sorts the status %i as %s", (status, problem) => {
    expect(ReplayProblems.from(new ApiError(status))).toBe(problem);
  });

  it("takes any other error for a failure", () => {
    expect(ReplayProblems.from(new TypeError("network"))).toBe("failed");
  });

  it("has a text for each problem", () => {
    expect(ReplayProblems.message("forbidden")).toBe("replay.error.forbidden");
    expect(ReplayProblems.message("failed")).toBe("replay.error.failed");
  });
});
