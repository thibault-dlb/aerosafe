import { describe, expect, it } from "vitest";

import { User } from "./User";

const json = { id: "01HZ", email: "jane.doe@example.fr", role: "USER", is_active: true };

describe("User", () => {
  it("is read from the JSON of the API", () => {
    const user = User.fromJson(json);

    expect(user).toMatchObject({ id: "01HZ", email: "jane.doe@example.fr", role: "USER", isActive: true });
  });

  it("knows whether it is a Supervisor", () => {
    expect(User.fromJson(json).isSupervisor).toBe(false);
    expect(User.fromJson({ ...json, role: "SUPERVISOR" }).isSupervisor).toBe(true);
  });

  it("gives a Supervisor every role and a User only its own", () => {
    const user = User.fromJson(json);
    const supervisor = User.fromJson({ ...json, role: "SUPERVISOR" });

    expect(user.can("USER")).toBe(true);
    expect(user.can("SUPERVISOR")).toBe(false);
    expect(supervisor.can("USER")).toBe(true);
    expect(supervisor.can("SUPERVISOR")).toBe(true);
  });

  it.each([
    ["jane.doe@example.fr", "JD"],
    ["jean-luc_picard@x.fr", "JL"],
    ["thibault@x.fr", "TH"],
    ["a@x.fr", "A"],
    ["@x.fr", "?"],
  ])("builds the initials of %s", (email, initials) => {
    expect(User.fromJson({ ...json, email }).initials).toBe(initials);
  });
});
