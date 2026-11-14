import { describe, expect, it } from "vitest";

import { AuthRedirect } from "./AuthRedirect";

describe("AuthRedirect", () => {
  it("goes back to the page that was asked for", () => {
    expect(AuthRedirect.target(AuthRedirect.state("/alerts?status=active"))).toBe("/alerts?status=active");
  });

  it.each([undefined, null, "/alerts", {}, { from: 3 }])("falls back to the dashboard for %j", (state) => {
    expect(AuthRedirect.target(state)).toBe(AuthRedirect.DEFAULT);
  });

  it.each(["https://elsewhere.example", "//elsewhere.example", "alerts", "/login", "/signup?x=1", "/login/"])(
    "refuses %s",
    (from) => {
      expect(AuthRedirect.target({ from })).toBe(AuthRedirect.DEFAULT);
    },
  );

  it("accepts a page whose name only starts like the log in screen", () => {
    expect(AuthRedirect.target({ from: "/login-help" })).toBe("/login-help");
  });
});
