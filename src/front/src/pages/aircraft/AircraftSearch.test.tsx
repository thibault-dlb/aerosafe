import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";
import { MapService } from "@/services/MapService";

import AircraftSearch from "./AircraftSearch";
import { parseArea } from "./area";
import { memoryStore } from "./testStore";

const LOCATED = new Aircraft(
  "01JC0000000000000000000001",
  "3c6444",
  "D-AIBD",
  "Airbus A319",
  "Lufthansa",
  new Date("2026-11-09T10:00:00Z"),
  48.85,
  2.35,
  10972.8,
);
const UNSEEN = new Aircraft("01JC0000000000000000000002", "4ca123", null, null, null, null, null, null);

function renderWith(search: AircraftService["search"], language: "en" | "fr" = "en") {
  const service = { search: vi.fn(search) } as unknown as AircraftService;
  render(
    <PreferencesProvider store={memoryStore(language)}>
      <MemoryRouter>
        <AircraftSearch service={service} />
      </MemoryRouter>
    </PreferencesProvider>,
  );
  return service.search as ReturnType<typeof vi.fn>;
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseArea", () => {
  it("is empty when no bound is filled", () => {
    expect(parseArea({ south: "", west: " ", north: "", east: "" })).toBeUndefined();
  });

  it("is invalid when only some bounds are filled", () => {
    expect(parseArea({ south: "48", west: "", north: "", east: "" })).toBeNull();
  });

  it("reads the four bounds as numbers", () => {
    expect(parseArea({ south: "48.1", west: "1.4", north: "49.3", east: "3.6" })).toEqual({
      south: 48.1,
      west: 1.4,
      north: 49.3,
      east: 3.6,
    });
  });
});

describe("AircraftSearch", () => {
  it("shows its title", () => {
    renderWith(async () => []);

    expect(screen.getByRole("heading", { name: "Aircraft search" })).toBeInTheDocument();
  });

  it("is in French by default", async () => {
    renderWith(async () => [], "fr");

    expect(screen.getByRole("heading", { name: "Recherche d'aéronefs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Aucun aéronef");
  });

  it("sends the criteria and lists the aircraft with a link to their record", async () => {
    const search = renderWith(async () => [LOCATED, UNSEEN]);

    fill("ICAO24 address", "3c64");
    fill("Airline", "Luft");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("2 aircraft found")).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith({
      icao24: "3c64",
      registration: "",
      airline: "Luft",
      area: undefined,
    });
    expect(screen.getByRole("link", { name: "D-AIBD" })).toHaveAttribute(
      "href",
      "/aircraft/01JC0000000000000000000001",
    );
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Map of 1 aircraft" })).toBeInTheDocument();
  });

  it("puts the altitude on the map so the marker takes its shade", async () => {
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    renderWith(async () => [LOCATED]);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("1 aircraft found");
    expect(showAircraft).toHaveBeenLastCalledWith([
      { latitude: 48.85, longitude: 2.35, altitude: 10972.8, label: "D-AIBD" },
    ]);
  });

  it("sends the area when its four bounds are filled", async () => {
    const search = renderWith(async () => [LOCATED]);

    fill("South", "48.1");
    fill("West", "1.4");
    fill("North", "49.3");
    fill("East", "3.6");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("1 aircraft found");
    expect(search.mock.calls[0][0].area).toEqual({ south: 48.1, west: 1.4, north: 49.3, east: 3.6 });
  });

  it("refuses an incomplete area without calling the API", async () => {
    const search = renderWith(async () => []);

    fill("South", "48.1");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("four bounds");
    expect(search).not.toHaveBeenCalled();
  });

  it("suggests broader criteria when nothing matches", async () => {
    renderWith(async () => []);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Try broader criteria");
  });

  it("asks to log in when the API refuses the request", async () => {
    renderWith(async () => {
      throw new ApiError(401);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Log in");
  });

  it("explains when the server cannot be reached", async () => {
    renderWith(async () => {
      throw new TypeError("Failed to fetch");
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be reached");
  });
});
