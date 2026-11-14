import { describe, expect, it } from "vitest";

import { ReplayTime } from "./ReplayTime";

const MOMENT = new Date("2022-08-14T15:30:45Z");

describe("ReplayTime", () => {
  it("shows an instant in UTC, whatever the time zone of the computer", () => {
    expect(ReplayTime.display(MOMENT, "en")).toContain("15:30:45");
    expect(ReplayTime.display(MOMENT, "fr")).toContain("15:30:45");
  });

  it("follows the language of the interface", () => {
    expect(ReplayTime.display(MOMENT, "fr")).toContain("août");
    expect(ReplayTime.display(MOMENT, "en")).toContain("Aug");
  });

  it("gives a short form without the seconds", () => {
    expect(ReplayTime.short(MOMENT, "fr")).toContain("15:30");
    expect(ReplayTime.short(MOMENT, "fr")).not.toContain("45");
  });

  it("writes and reads the value of a date and time field as UTC", () => {
    expect(ReplayTime.toInput(MOMENT)).toBe("2022-08-14T15:30");
    expect(ReplayTime.fromInput("2022-08-14T15:30")).toEqual(new Date("2022-08-14T15:30:00Z"));
  });

  it("refuses a value that is not a date and time", () => {
    expect(ReplayTime.fromInput("")).toBeNull();
    expect(ReplayTime.fromInput("2022-08-14")).toBeNull();
    expect(ReplayTime.fromInput("2022-13-45T99:99")).toBeNull();
  });

  it("offers the first minute that is not before the start of the data", () => {
    expect(ReplayTime.firstInput(new Date("2022-08-06T00:47:54Z"))).toBe("2022-08-06T00:48");
    expect(ReplayTime.firstInput(new Date("2022-08-06T00:47:00Z"))).toBe("2022-08-06T00:47");
    expect(ReplayTime.firstInput(new Date("2022-08-06T23:59:30Z"))).toBe("2022-08-07T00:00");
  });
});
