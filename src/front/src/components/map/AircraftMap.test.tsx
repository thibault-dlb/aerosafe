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

  it("draws the search area it is given", () => {
    const showArea = vi.spyOn(MapService.prototype, "showArea");
    const area = { south: 48, west: 1.5, north: 49, east: 3 };

    render(<AircraftMap aircraft={[]} area={area} />);

    expect(showArea).toHaveBeenLastCalledWith(area);
  });

  it("lets the user draw an area only while asked to, and reports it", () => {
    const start = vi.spyOn(MapService.prototype, "startAreaSelection");
    const stop = vi.spyOn(MapService.prototype, "stopAreaSelection");
    const onAreaDrawn = vi.fn();

    const { rerender } = render(<AircraftMap aircraft={[]} />);
    expect(start).not.toHaveBeenCalled();

    rerender(<AircraftMap aircraft={[]} selectingArea onAreaDrawn={onAreaDrawn} />);
    expect(start).toHaveBeenCalledOnce();
    const report = start.mock.calls[0][0];
    const area = { south: 48, west: 1.5, north: 49, east: 3 };
    report(area);
    expect(onAreaDrawn).toHaveBeenCalledWith(area);

    rerender(<AircraftMap aircraft={[]} onAreaDrawn={onAreaDrawn} />);
    expect(stop).toHaveBeenCalled();
  });

  it("can be given more height", () => {
    render(<AircraftMap aircraft={[]} size="large" />);

    expect(screen.getByRole("img")).toHaveClass(/large/);
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
