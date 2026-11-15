import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import { ApiError } from "@/services/ApiClient";
import type { AircraftService } from "@/services/AircraftService";
import { MapService } from "@/services/MapService";
import { renderInApp } from "@/test/app";

import AircraftSearch from "./AircraftSearch";

const SEEN = new Date("2026-11-09T10:00:00Z");
const FLYING = new Aircraft("01JC0000000000000000000001", "3c6444", "D-AIBD", "Airbus A319", "Lufthansa", SEEN, 48.85, 2.35, 10400, 284, false);
const GROUNDED = new Aircraft("01JC0000000000000000000002", "4ca123", null, null, null, null, 49.0, 2.5, 0, 0, true);
const NOWHERE = new Aircraft("01JC0000000000000000000003", "4ca124", "F-HBNK", "Airbus A320", "Air France", null, null, null);

afterEach(() => {
  vi.restoreAllMocks();
});

function renderSearch(search: AircraftService["search"] = async () => [FLYING, GROUNDED], preferences: Record<string, string> = {}) {
  const service = { search: vi.fn(search) } as unknown as AircraftService;
  renderInApp(<AircraftSearch service={service} />, { preferences });
  return service.search as ReturnType<typeof vi.fn>;
}

function type(text: string) {
  fireEvent.change(screen.getByLabelText("Rechercher un aéronef"), { target: { value: text } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Chercher" }));
}

describe("AircraftSearch", () => {
  it("shows its title, examples and what to do first", () => {
    renderSearch();

    expect(screen.getByRole("heading", { level: 1, name: "Recherche d'aéronefs" })).toBeInTheDocument();
    expect(screen.getByText("F-GKXA")).toBeInTheDocument();
    expect(screen.getByText(/Saisissez une adresse/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Carte de 0 aéronef(s)" })).toBeInTheDocument();
  });

  it.each([
    ["Air France", "compagnie « Air France »"],
    ["F-GKXA", "immatriculation « F-GKXA »"],
    ["3c6444", "adresse ICAO24 « 3c6444 »"],
  ])("tells how it understood %s", (typed, understood) => {
    renderSearch();

    type(typed);

    expect(screen.getByText("Recherche comprise comme :")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: understood })).toBeDisabled();
  });

  it("searches with the criterion the text stands for", async () => {
    const search = renderSearch();

    type("Air France");
    submit();

    await waitFor(() => expect(search).toHaveBeenCalledWith({ airline: "Air France", area: undefined }));
  });

  it("searches with no criterion when the field is empty", async () => {
    const search = renderSearch();

    submit();

    await waitFor(() => expect(search).toHaveBeenCalledWith({ area: undefined }));
  });

  it("lists the aircraft found with their altitude, their state and a link to their record", async () => {
    renderSearch();

    submit();

    expect(await screen.findByRole("heading", { name: "2 aéronefs" })).toBeInTheDocument();
    const flying = screen.getByRole("link", { name: /D-AIBD/ });
    expect(flying).toHaveAttribute("href", "/aircraft/01JC0000000000000000000001");
    expect(flying).toHaveTextContent("10400 m");
    expect(flying).toHaveTextContent("Airbus A319 · Lufthansa");
    const grounded = screen.getByRole("link", { name: /4CA123/ });
    expect(grounded).toHaveTextContent("Au sol");
    expect(grounded).toHaveTextContent("Inconnu · Inconnu");
    expect(grounded).toHaveTextContent("Jamais");
    expect(screen.getByRole("img", { name: "Carte de 2 aéronef(s)" })).toBeInTheDocument();
  });

  it("counts one aircraft in the singular, and leaves the ones without a position off the map", async () => {
    renderSearch(async () => [NOWHERE]);

    submit();

    expect(await screen.findByRole("heading", { name: "1 aéronef" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Carte de 0 aéronef(s)" })).toBeInTheDocument();
  });

  it("shows the altitude in feet with the aeronautical units", async () => {
    renderSearch(undefined, { "aerosafe.units": "aeronautical" });

    submit();

    expect(await screen.findByRole("link", { name: /D-AIBD/ })).toHaveTextContent("34121 ft");
  });

  it("says when nothing matches", async () => {
    renderSearch(async () => []);

    submit();

    expect(await screen.findByText("Aucun écho")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0 aéronefs" })).toBeInTheDocument();
  });

  it("explains a failed search", async () => {
    renderSearch(async () => {
      throw new ApiError(422);
    });

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Vérifiez les critères de recherche.");
    expect(screen.getByText(/Saisissez une adresse/)).toBeInTheDocument();
  });

  it("blocks the search button while it runs", async () => {
    renderSearch(() => new Promise(() => undefined));

    submit();

    expect(await screen.findByRole("button", { name: "Chercher" })).toBeDisabled();
    expect(screen.getByText("Chargement…")).toBeInTheDocument();
  });

  it("rings the aircraft the pointer is on, on the map", async () => {
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    renderSearch();
    submit();

    fireEvent.mouseEnter(await screen.findByRole("link", { name: /D-AIBD/ }));

    await waitFor(() => {
      const positions = showAircraft.mock.lastCall?.[0] ?? [];
      expect(positions.map((position) => position.selected)).toEqual([true, false]);
    });
    expect(screen.getByRole("link", { name: /D-AIBD/ }).className).toMatch(/selected/);
  });

  it("gives the heading and the ground state of each aircraft to the map", async () => {
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    renderSearch();

    submit();

    await waitFor(() => {
      const positions = showAircraft.mock.lastCall?.[0] ?? [];
      expect(positions).toHaveLength(2);
    });
    const [flying, grounded] = showAircraft.mock.lastCall?.[0] ?? [];
    expect(flying).toMatchObject({ heading: 284, onGround: false, label: "D-AIBD" });
    expect(grounded).toMatchObject({ onGround: true, label: "4CA123" });
  });

  describe("the area drawn on the map", () => {
    const AREA = { south: 48.12, west: 1.5, north: 49.04, east: 3.2 };

    it("lets the user draw while the button is on, and tells how", () => {
      const start = vi.spyOn(MapService.prototype, "startAreaSelection");
      const stop = vi.spyOn(MapService.prototype, "stopAreaSelection");
      renderSearch();

      fireEvent.click(screen.getByRole("button", { name: "Tracer une zone" }));

      expect(start).toHaveBeenCalledOnce();
      expect(screen.getByRole("button", { name: "Annuler le tracé" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Glissez sur la carte pour tracer la zone de recherche")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Annuler le tracé" }));
      expect(stop).toHaveBeenCalled();
      expect(screen.queryByText("Glissez sur la carte pour tracer la zone de recherche")).not.toBeInTheDocument();
    });

    it("searches the area as soon as it is drawn, and shows it as a filter", async () => {
      const start = vi.spyOn(MapService.prototype, "startAreaSelection");
      const search = renderSearch();
      fireEvent.click(screen.getByRole("button", { name: "Tracer une zone" }));

      start.mock.lastCall?.[0](AREA);

      await waitFor(() => expect(search).toHaveBeenCalledWith({ area: AREA }));
      // The filter shows once the state has settled, which can be a moment after the search starts.
      expect(await screen.findByText("zone 48.1° – 49.0° N · 1.5° – 3.2° E")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Tracer une zone" })).toHaveAttribute("aria-pressed", "false"),
      );
    });

    it("combines the text and the area", async () => {
      const start = vi.spyOn(MapService.prototype, "startAreaSelection");
      const search = renderSearch();
      type("Air France");
      fireEvent.click(screen.getByRole("button", { name: "Tracer une zone" }));

      start.mock.lastCall?.[0](AREA);

      await waitFor(() => expect(search).toHaveBeenCalledWith({ airline: "Air France", area: AREA }));
    });

    it("removes the area and searches again, once there are results", async () => {
      const start = vi.spyOn(MapService.prototype, "startAreaSelection");
      const search = renderSearch();
      fireEvent.click(screen.getByRole("button", { name: "Tracer une zone" }));
      start.mock.lastCall?.[0](AREA);
      await screen.findByRole("heading", { name: "2 aéronefs" });

      fireEvent.click(screen.getByRole("button", { name: "Retirer la zone" }));

      await waitFor(() => expect(search).toHaveBeenLastCalledWith({ area: undefined }));
      expect(screen.queryByText(/zone 48/)).not.toBeInTheDocument();
    });

    it("removes the area without a search when there was none yet", () => {
      const start = vi.spyOn(MapService.prototype, "startAreaSelection");
      const search = renderSearch(() => new Promise(() => undefined));
      fireEvent.click(screen.getByRole("button", { name: "Tracer une zone" }));
      act(() => start.mock.lastCall?.[0](AREA));
      expect(search).toHaveBeenCalledTimes(1);
      search.mockClear();

      fireEvent.click(screen.getByRole("button", { name: "Retirer la zone" }));

      expect(search).not.toHaveBeenCalled();
    });
  });
});
