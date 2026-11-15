import { afterEach, describe, expect, it, vi } from "vitest";

import { TrafficSprites } from "./TrafficSprites";

afterEach(() => vi.unstubAllGlobals());

function fakeCanvas(): HTMLCanvasElement {
  const context = new Proxy({}, { get: () => () => undefined, set: () => true });
  return { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
}

describe("TrafficSprites", () => {
  it("rounds a heading to a step of five degrees", () => {
    expect(TrafficSprites.step(0)).toBe(0);
    expect(TrafficSprites.step(2)).toBe(0);
    expect(TrafficSprites.step(3)).toBe(1);
    expect(TrafficSprites.step(359)).toBe(0);
    expect(TrafficSprites.step(-10)).toBe(70);
    expect(TrafficSprites.step(null)).toBe(0);
    expect(TrafficSprites.step(Number.NaN)).toBe(0);
  });

  it("grows the silhouette with the zoom, between two limits", () => {
    expect(TrafficSprites.scale(2)).toBe(0.35);
    expect(TrafficSprites.scale(20)).toBe(0.85);
    expect(TrafficSprites.scale(8)).toBeGreaterThan(TrafficSprites.scale(6));
  });

  it("draws a sprite once for a colour, a size and a heading", () => {
    vi.stubGlobal("Path2D", class {});
    const sprites = new TrafficSprites(fakeCanvas);

    const first = sprites.plane("#fff", "#000", 91, 0.5, 2);
    const again = sprites.plane("#fff", "#000", 92, 0.5, 2);
    const other = sprites.plane("#f00", "#000", 91, 0.5, 2);

    expect(first).toBe(again);
    expect(other).not.toBe(first);
    expect(sprites.size).toBe(2);
    expect(first?.box).toBe(Math.ceil(28 * 0.5 + 4));
  });

  it("gives nothing where there is no canvas to draw on", () => {
    const sprites = new TrafficSprites(() => ({ getContext: () => null }) as unknown as HTMLCanvasElement);

    expect(sprites.plane("#fff", "#000", 0, 0.5, 1)).toBeNull();
  });
});
