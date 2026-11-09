import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapService } from "@/services/MapService";

import AircraftMap from "./AircraftMap";

const PARIS = { latitude: 48.85, longitude: 2.35 };
const LYON = { latitude: 45.76, longitude: 4.83 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AircraftMap", () => {
  it("names the number of aircraft it shows", () => {
    render(<AircraftMap aircraft={[PARIS]} />);

    expect(screen.getByRole("img", { name: "Map of 1 aircraft" })).toBeInTheDocument();
  });

  it("draws the aircraft and the trajectory segments", () => {
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    const showSegments = vi.spyOn(MapService.prototype, "showSegments");

    render(<AircraftMap aircraft={[PARIS]} trajectory={[[PARIS, LYON]]} />);

    expect(showAircraft).toHaveBeenLastCalledWith([PARIS]);
    expect(showSegments).toHaveBeenLastCalledWith([[PARIS, LYON]]);
  });

  it("redraws when the aircraft change and frees the map when removed", () => {
    const showAircraft = vi.spyOn(MapService.prototype, "showAircraft");
    const destroy = vi.spyOn(MapService.prototype, "destroy");

    const { rerender, unmount } = render(<AircraftMap aircraft={[PARIS]} />);
    rerender(<AircraftMap aircraft={[PARIS, LYON]} />);
    unmount();

    expect(showAircraft).toHaveBeenLastCalledWith([PARIS, LYON]);
    expect(destroy).toHaveBeenCalled();
  });
});
