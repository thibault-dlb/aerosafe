import type { AircraftSearch } from "@/services/AircraftService";

/** What a search text was taken for. */
export type QueryKind = "icao24" | "registration" | "airline";

export interface ParsedQuery {
  /** `null` for an empty text: no criterion. */
  kind: QueryKind | null;
  /** The criterion to send, with the other criteria left out. */
  criteria: Pick<AircraftSearch, "icao24" | "registration" | "airline">;
  /** The text, trimmed. */
  text: string;
}

/**
 * Reads the one search field of the aircraft page. The API has three criteria; the user types
 * one text, and the shape of it tells which criterion it is:
 * - six hexadecimal characters, or a start of an address with at least a digit (`3c64`): the ICAO24 address;
 * - a registration, which has a hyphen (`F-GKXA`, or its start `F-GK`) or is American (`N123AB`);
 * - anything else (`Air France`, `AFR`): the airline.
 */
export class AircraftQuery {
  private static readonly ADDRESS = /^[0-9a-f]{6}$/i;
  private static readonly ADDRESS_START = /^[0-9a-f]{1,5}$/i;
  private static readonly DIGIT = /\d/;
  private static readonly HYPHENATED_REGISTRATION = /^[a-z0-9]{1,2}-[a-z0-9]*$/i;
  private static readonly AMERICAN_REGISTRATION = /^n\d[a-z0-9]{0,5}$/i;

  static parse(input: string): ParsedQuery {
    const text = input.trim();
    if (text === "") {
      return { kind: null, criteria: {}, text };
    }
    if (AircraftQuery.ADDRESS.test(text) || (AircraftQuery.ADDRESS_START.test(text) && AircraftQuery.DIGIT.test(text))) {
      return { kind: "icao24", criteria: { icao24: text.toLowerCase() }, text };
    }
    if (AircraftQuery.HYPHENATED_REGISTRATION.test(text) || AircraftQuery.AMERICAN_REGISTRATION.test(text)) {
      return { kind: "registration", criteria: { registration: text.toUpperCase() }, text };
    }
    return { kind: "airline", criteria: { airline: text }, text };
  }
}
