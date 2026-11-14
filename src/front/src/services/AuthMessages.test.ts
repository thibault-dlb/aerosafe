import { describe, expect, it } from "vitest";

import { ApiError } from "./ApiClient";
import { AuthMessages } from "./AuthMessages";

describe("AuthMessages", () => {
  it.each([
    [401, "auth.error.invalid"],
    [409, "auth.error.taken"],
    [422, "auth.error.invalidInput"],
    [429, "auth.error.locked"],
  ] as const)("explains an answer %s", (status, key) => {
    expect(AuthMessages.key(new ApiError(status))).toBe(key);
  });

  it.each([new ApiError(500), new TypeError("offline"), "failure"])("calls %s a network failure", (error) => {
    expect(AuthMessages.key(error)).toBe("auth.error.network");
  });
});
