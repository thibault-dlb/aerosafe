import { describe, expect, it } from "vitest";

import { AircraftQuery } from "./AircraftQuery";

describe("AircraftQuery", () => {
  it("takes an empty text for no criterion", () => {
    expect(AircraftQuery.parse("   ")).toEqual({ kind: null, criteria: {}, text: "" });
  });

  it.each(["3c6444", "3C6444", "40621D", "123456"])("takes %s for an ICAO24 address, in lower case", (text) => {
    const parsed = AircraftQuery.parse(text);

    expect(parsed.kind).toBe("icao24");
    expect(parsed.criteria).toEqual({ icao24: text.toLowerCase() });
  });

  it.each(["3c64", "3", "a1b2c"])("takes %s for the start of an address: it has a digit", (text) => {
    expect(AircraftQuery.parse(text).kind).toBe("icao24");
  });

  it.each(["F-GKXA", "d-aibd", "F-GK", "F-", "G-ABCD", "N123AB", "n1"])("takes %s for a registration, in capitals", (text) => {
    const parsed = AircraftQuery.parse(text);

    expect(parsed.kind).toBe("registration");
    expect(parsed.criteria).toEqual({ registration: text.toUpperCase() });
  });

  it.each(["Air France", "AFR", "Lufthansa", "ace", "Easy Jet", "a1b2c3d"])("takes %s for an airline, as it is typed", (text) => {
    const parsed = AircraftQuery.parse(text);

    expect(parsed.kind).toBe("airline");
    expect(parsed.criteria).toEqual({ airline: text });
  });

  it("trims the text, and keeps it for the hint under the field", () => {
    const parsed = AircraftQuery.parse("  Air France ");

    expect(parsed.text).toBe("Air France");
    expect(parsed.criteria).toEqual({ airline: "Air France" });
  });
});
