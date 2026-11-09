import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";

import AircraftSearch from "./AircraftSearch";
import { parseArea } from "./area";

const LOCATED = new Aircraft(
  "01JC0000000000000000000001",
  "3c6444",
  "D-AIBD",
  "Airbus A319",
  "Lufthansa",
  new Date("2026-11-09T10:00:00Z"),
  48.85,
  2.35,
);
const UNSEEN = new Aircraft("01JC0000000000000000000002", "4ca123", null, null, null, null, null, null);

function renderWith(search: AircraftService["search"]) {
  const service = { search: vi.fn(search) } as unknown as AircraftService;
  render(
    <MemoryRouter>
      <AircraftSearch service={service} />
    </MemoryRouter>,
  );
  return service.search as ReturnType<typeof vi.fn>;
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

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
