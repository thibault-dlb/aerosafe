import { describe, expect, it } from "vitest";

import { PasswordRules } from "./PasswordRules";

describe("PasswordRules", () => {
  it("asks for 12 characters at least, and 128 at most", () => {
    expect(PasswordRules.MIN_LENGTH).toBe(12);
    expect(PasswordRules.MAX_LENGTH).toBe(128);
  });

  it.each([
    ["", false],
    ["12345678901", false],
    ["123456789012", true],
    ["a much longer password", true],
  ])("tells whether %j is long enough", (password, expected) => {
    expect(PasswordRules.isLongEnough(password)).toBe(expected);
  });

  it("counts the required characters, up to the minimum", () => {
    expect(PasswordRules.filled("")).toBe(0);
    expect(PasswordRules.filled("abcde")).toBe(5);
    expect(PasswordRules.filled("a much longer password")).toBe(12);
  });
});
