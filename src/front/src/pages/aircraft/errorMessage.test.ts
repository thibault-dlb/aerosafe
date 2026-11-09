import { describe, expect, it } from "vitest";

import { ApiError } from "@/services/ApiClient";

import { errorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it.each([
    [401, "Log in"],
    [403, "not allowed"],
    [422, "criteria"],
    [500, "could not be reached"],
  ])("explains a %i answer", (status, text) => {
    expect(errorMessage(new ApiError(status))).toContain(text);
  });

  it("uses the given message for a missing item", () => {
    expect(errorMessage(new ApiError(404), "Aircraft not found.")).toBe("Aircraft not found.");
  });

  it("treats any other failure as a network problem", () => {
    expect(errorMessage(new Error("boom"))).toContain("could not be reached");
  });
});
