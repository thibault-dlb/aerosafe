import { describe, expect, it } from "vitest";

import { MarkerIcon } from "./MarkerIcon";

const BASE = { color: "#e3b23c", outline: "#130e04" };

describe("MarkerIcon", () => {
  it("turns the silhouette with the heading", () => {
    expect(MarkerIcon.html({ ...BASE, heading: 284 })).toContain("rotate(284)");
  });

  it.each([
    [null, 0],
    [undefined, 0],
    [Number.NaN, 0],
    [0, 0],
    [359.6, 0],
    [360, 0],
    [-90, 270],
    [725, 5],
  ])("reads a heading of %s as a rotation of %s degrees", (heading, rotation) => {
    expect(MarkerIcon.rotation(heading)).toBe(rotation);
  });

  it("draws an aircraft on the ground as a hollow diamond", () => {
    const html = MarkerIcon.html({ ...BASE, onGround: true, heading: 90 });

    expect(html).toContain("M0 -6L6 0L0 6L-6 0Z");
    expect(html).not.toContain("rotate(");
    expect(html).toContain('fill="none" stroke="#e3b23c"');
  });

  it("adds a pulsing echo for an alert and a dashed ring for the selection", () => {
    const plain = MarkerIcon.html(BASE);
    const marked = MarkerIcon.html({ ...BASE, alertColor: "#e5604d", selectedColor: "#3dd6c4" });

    expect(plain).not.toContain("halo");
    expect(plain).not.toContain("stroke-dasharray");
    expect(marked).toContain('class="halo"');
    expect(marked).toContain('stroke="#e5604d"');
    expect(marked).toContain('stroke="#3dd6c4"');
    expect(marked).toContain("stroke-dasharray");
  });

  it("is decoration for screen readers: the marker carries its own title", () => {
    expect(MarkerIcon.html(BASE)).toContain('aria-hidden="true"');
  });

  it("never lets a colour break out of its attribute", () => {
    const html = MarkerIcon.html({ color: '"><script>alert(1)</script>', outline: "red", alertColor: '" onload="x' });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('onload="x');
    expect(html).toContain("currentColor");
  });
});
