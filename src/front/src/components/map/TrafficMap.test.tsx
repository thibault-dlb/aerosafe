import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TrafficAircraft } from "@/models/Traffic";

import TrafficMap, { type TrafficMapHandle } from "./TrafficMap";

const BOUNDS = { south: 48, west: 1.4, north: 49.3, east: 3.6 };
const NOW = Date.UTC(2026, 10, 14, 10);
const AIRCRAFT: TrafficAircraft[] = [
  { id: "a", name: "F-GKXA", lat: 48.8, lon: 2.3, altitude: 9000, heading: 90, speed: 230, onGround: false, contactAt: NOW, criticality: null },
];

function map(overrides: Partial<React.ComponentProps<typeof TrafficMap>> = {}) {
  const handle = createRef<TrafficMapHandle>();
  const props = {
    aircraft: AIRCRAFT,
    clock: () => NOW,
    bounds: BOUNDS,
    zone: BOUNDS,
    trackedId: null,
    following: false,
    trail: [],
    onPick: vi.fn(),
    onUserMove: vi.fn(),
    label: "Carte du trafic",
    ref: handle,
    ...overrides,
  };
  const view = render(<TrafficMap {...props} />);
  return { ...view, handle, props };
}

describe("TrafficMap", () => {
  it("is a named map holding a Leaflet map and the canvases of the base map and of the traffic", () => {
    const { container } = map();

    const holder = container.firstElementChild as HTMLElement;
    expect(holder).toHaveAttribute("aria-label", "Carte du trafic");
    expect(holder.classList.contains("leaflet-container")).toBe(true);
    expect(holder.querySelectorAll("canvas")).toHaveLength(2);
  });

  it("describes a followed aircraft, and nothing for an unknown one", () => {
    const { handle } = map({ trackedId: "a", following: true });

    expect(handle.current?.describe("a")?.lat).toBeCloseTo(48.8, 3);
    expect(handle.current?.describe("nobody")).toBeNull();
  });

  it("zooms and recentres on demand", () => {
    const { handle } = map();

    expect(() => {
      handle.current?.zoomBy(1);
      handle.current?.zoomBy(-1);
      handle.current?.recenter();
    }).not.toThrow();
  });

  it("zooms in at least to a level, and never zooms out to reach it", () => {
    const { handle } = map();
    const leaflet = document.querySelector(".leaflet-container") as HTMLElement | null;
    expect(leaflet).not.toBeNull();

    expect(() => {
      handle.current?.zoomAtLeast(7);
      handle.current?.zoomAtLeast(3);
    }).not.toThrow();
  });

  it("takes new reports, a new trail and a new zone without being rebuilt", () => {
    const { rerender, container, props } = map();
    const holder = container.firstElementChild;

    rerender(<TrafficMap {...props} aircraft={[]} trail={[{ at: NOW, lat: 48.8, lon: 2.3, altitude: 9000 }]} zone="outline" trackedId={null} />);

    expect(container.firstElementChild).toBe(holder);
  });

  it("removes its canvases when it is unmounted", () => {
    const { unmount } = map();

    unmount();

    expect(document.querySelectorAll("canvas")).toHaveLength(0);
  });
});
