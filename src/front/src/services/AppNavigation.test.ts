import { describe, expect, it } from "vitest";

import { User } from "@/models/User";

import { AppNavigation } from "./AppNavigation";

const user = (role: string) => new User("01HZ", "jane@example.fr", role, true);

describe("AppNavigation", () => {
  it("shows the dashboard and the aircraft to everyone", () => {
    expect(AppNavigation.common().map((item) => item.to)).toEqual(["/dashboard", "/aircraft"]);
  });

  it("keeps the supervision pages for a Supervisor", () => {
    expect(AppNavigation.supervision(user("SUPERVISOR")).map((item) => item.to)).toEqual([
      "/alerts",
      "/rules",
      "/admin/accounts",
    ]);
    expect(AppNavigation.supervision(user("USER"))).toEqual([]);
    expect(AppNavigation.supervision(null)).toEqual([]);
  });

  it.each([
    ["/dashboard", "/dashboard"],
    ["/aircraft", "/aircraft"],
    ["/aircraft/01HZ", "/aircraft"],
    ["/flights/01HZ", "/aircraft"],
    ["/alerts", "/alerts"],
    ["/admin/accounts", "/admin/accounts"],
  ])("puts %s in the section %s", (pathname, section) => {
    expect(AppNavigation.sectionOf(pathname)?.to).toBe(section);
  });

  it("does not put an address that only starts like a section in it", () => {
    expect(AppNavigation.sectionOf("/aircraftx")).toBeNull();
    expect(AppNavigation.sectionOf("/nowhere")).toBeNull();
  });
});
