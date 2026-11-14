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

  it("explains the failures of the account list", () => {
    const messages = ErrorMessages.ACCOUNTS;

    expect(messages.key(new ApiError(403))).toBe("accounts.error.own");
    expect(messages.key(new ApiError(404))).toBe("accounts.error.notFound");
    expect(messages.key(new ApiError(409))).toBe("accounts.error.conflict");
  });

  it("explains the failures of the creation of an account", () => {
    expect(ErrorMessages.NEW_ACCOUNT.key(new ApiError(409))).toBe("auth.error.taken");
    expect(ErrorMessages.NEW_ACCOUNT.key(new ApiError(422))).toBe("auth.error.invalidInput");
  });

  it("explains the failures of a password change", () => {
    expect(ErrorMessages.PASSWORD.key(new ApiError(400))).toBe("account.password.error.wrong");
    expect(ErrorMessages.PASSWORD.key(new ApiError(422))).toBe("account.password.error.invalid");
    expect(ErrorMessages.PASSWORD.key(new ApiError(429))).toBe("auth.error.locked");
  });

  it("explains the failures of the deletion of an account", () => {
    expect(ErrorMessages.DELETION.key(new ApiError(400))).toBe("account.delete.error.wrong");
    expect(ErrorMessages.DELETION.key(new ApiError(409))).toBe("account.delete.error.lastSupervisor");
    expect(ErrorMessages.DELETION.key(new ApiError(429))).toBe("auth.error.locked");
  });

  it("treats any other failure as a network problem", () => {
    expect(new ErrorMessages().key(new Error("boom"))).toBe("error.unreachable");
  });

  it("has a text for each key, in the language of the interface", () => {
    expect(en[ErrorMessages.SUPERVISOR.key(new ApiError(409))]).toMatch(/already processed/);
    expect(en[ErrorMessages.UNREACHABLE]).toMatch(/could not be reached/);
  });
});
