import { describe, expect, it } from "vitest";

import { en } from "@/i18n/en";

import { ApiError } from "./ApiClient";
import { ErrorMessages } from "./ErrorMessages";

describe("ErrorMessages", () => {
  it.each([
    [401, "error.login"],
    [403, "error.forbidden"],
    [404, "error.notFound"],
    [409, "error.conflict"],
    [422, "error.invalid"],
    [500, "error.unreachable"],
  ] as const)("explains a %i answer in general terms", (status, key) => {
    expect(new ErrorMessages().key(new ApiError(status))).toBe(key);
  });

  it("uses the texts of the page and keeps the others", () => {
    const messages = new ErrorMessages({ 404: "error.supervisor.notFound" });

    expect(messages.key(new ApiError(404))).toBe("error.supervisor.notFound");
    expect(messages.key(new ApiError(401))).toBe("error.login");
  });

  it("explains each failure on the Supervisor pages", () => {
    const messages = ErrorMessages.SUPERVISOR;

    expect(messages.key(new ApiError(401))).toBe("error.supervisor.login");
    expect(messages.key(new ApiError(403))).toBe("error.supervisor.forbidden");
    expect(messages.key(new ApiError(404))).toBe("error.supervisor.notFound");
    expect(messages.key(new ApiError(409))).toBe("error.supervisor.conflict");
    expect(messages.key(new ApiError(422))).toBe("error.invalid");
  });

  it("treats any other failure as a network problem", () => {
    expect(new ErrorMessages().key(new Error("boom"))).toBe("error.unreachable");
  });

  it("has a text for each key, in the language of the interface", () => {
    expect(en[ErrorMessages.SUPERVISOR.key(new ApiError(409))]).toMatch(/already processed/);
    expect(en[ErrorMessages.UNREACHABLE]).toMatch(/could not be reached/);
  });
});
