import { describe, expect, it } from "vitest";

import { ApiError } from "./ApiClient";
import { ErrorMessages } from "./ErrorMessages";

describe("ErrorMessages", () => {
  it.each([
    [401, "Log in"],
    [403, "not allowed"],
    [404, "Not found"],
    [409, "conflicts"],
    [422, "Check"],
    [500, "could not be reached"],
  ])("explains a %i answer in general terms", (status, text) => {
    expect(new ErrorMessages().describe(new ApiError(status))).toContain(text);
  });

  it("uses the texts of the page and keeps the others", () => {
    const messages = new ErrorMessages({ 404: "Aircraft not found." });

    expect(messages.describe(new ApiError(404))).toBe("Aircraft not found.");
    expect(messages.describe(new ApiError(401))).toContain("Log in");
  });

  it("explains each failure on the Supervisor pages", () => {
    const messages = ErrorMessages.SUPERVISOR;

    expect(messages.describe(new ApiError(401))).toMatch(/Log in as a Supervisor/);
    expect(messages.describe(new ApiError(403))).toMatch(/Only Supervisors/);
    expect(messages.describe(new ApiError(404))).toMatch(/no longer exists/);
    expect(messages.describe(new ApiError(409))).toMatch(/already processed/);
    expect(messages.describe(new ApiError(422))).toMatch(/Check/);
  });

  it("treats any other failure as a network problem", () => {
    expect(new ErrorMessages().describe(new Error("boom"))).toContain("could not be reached");
  });
});
