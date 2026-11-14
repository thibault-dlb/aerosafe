import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AircraftGlyph from "./AircraftGlyph";

function glyph(props: Parameters<typeof AircraftGlyph>[0]) {
  const { container } = render(<AircraftGlyph {...props} />);
  return container.querySelector("svg") as SVGSVGElement;
}

describe("AircraftGlyph", () => {
  it("is decoration for screen readers", () => {
    expect(glyph({})).toHaveAttribute("aria-hidden", "true");
  });

  it("turns the silhouette with the heading", () => {
    const svg = glyph({ heading: 284 });

    expect(svg.querySelector("g")).toHaveAttribute("transform", "rotate(284) scale(.8)");
  });

  it("points north without a heading", () => {
    expect(glyph({}).querySelector("g")).toHaveAttribute("transform", "rotate(0) scale(.8)");
  });

  it("draws an aircraft on the ground as a diamond", () => {
    const svg = glyph({ onGround: true, heading: 90 });

    expect(svg.querySelector("g")).toBeNull();
    expect(svg.querySelector("path")).toHaveAttribute("d", "M0 -6L6 0L0 6L-6 0Z");
  });

  it.each([
    [1000, undefined, /low/],
    [7000, undefined, /mid/],
    [11000, undefined, /high/],
    [null, undefined, /mid/],
    [undefined, undefined, /mid/],
    [11000, "HIGH", /alertHigh/],
    [11000, "MEDIUM", /alertMedium/],
    [11000, "LOW", /alertLow/],
  ] as const)("takes the shade of the altitude %s and the alert %s", (altitude, criticality, shade) => {
    expect(glyph({ altitude, criticality }).getAttribute("class")).toMatch(shade);
  });

  it("takes a size", () => {
    expect(glyph({ size: 32 })).toHaveAttribute("width", "32");
  });
});
