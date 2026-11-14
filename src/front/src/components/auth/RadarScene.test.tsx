import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";
import { RadarFlights } from "@/services/RadarFlights";

import RadarScene from "./RadarScene";

function renderRadar() {
  return render(
    <PreferencesProvider store={new PreferenceStore(null)}>
      <RadarScene />
    </PreferencesProvider>,
  );
}

function reducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("RadarScene", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a picture with a description for screen readers", () => {
    reducedMotion(true);
    renderRadar();

    expect(screen.getByRole("img", { name: /Écran radar/ })).toBeInTheDocument();
  });

  it("draws the country, its cities and every aircraft with its callsign", () => {
    reducedMotion(true);
    const { container } = renderRadar();

    expect(screen.getByText("Paris")).toBeInTheDocument();
    for (const flight of RadarFlights.FLIGHTS) {
      expect(screen.getByText(flight.callsign)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("[data-glyph]")).toHaveLength(RadarFlights.FLIGHTS.length);
  });

  it("is a still picture when reduced motion is asked for", () => {
    reducedMotion(true);
    const frames = vi.spyOn(window, "requestAnimationFrame");

    const { container } = renderRadar();

    expect(frames).not.toHaveBeenCalled();
    const still = RadarFlights.frame(RadarFlights.STILL_SECONDS);
    const first = container.querySelector("[data-glyph]")?.parentElement;
    expect(first?.getAttribute("transform")).toBe(`translate(${still.planes[0].x.toFixed(1)} ${still.planes[0].y.toFixed(1)})`);
  });

  it("moves by itself, and stops when it leaves", () => {
    reducedMotion(false);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);

    const { container, unmount } = renderRadar();
    expect(frames).toHaveLength(1);
    frames[0](performance.now() + 4500);

    const beam = container.querySelector("g[class*='beam']");
    expect(beam?.getAttribute("transform")).toMatch(/^rotate\(/);
    expect(frames).toHaveLength(2);

    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
