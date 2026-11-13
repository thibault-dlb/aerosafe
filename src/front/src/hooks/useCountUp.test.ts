import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "./useCountUp";

let now = 0;
let queue: { id: number; callback: FrameRequestCallback }[] = [];
let nextId = 1;

/** Moves the clock and runs the frames that were waiting. */
function tick(ms: number) {
  now += ms;
  const waiting = queue;
  queue = [];
  act(() => waiting.forEach(({ callback }) => callback(now)));
}

function reduceMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  now = 0;
  queue = [];
  nextId = 1;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queue.push({ id: nextId, callback });
    return nextId++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue = queue.filter((frame) => frame.id !== id);
  });
  reduceMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useCountUp", () => {
  it("stays at 0 until it is told to start", () => {
    const { result } = renderHook(() => useCountUp(856, false));

    expect(result.current).toBe(0);
    expect(queue).toHaveLength(0);
  });

  it("counts up to the target, slowing down as it arrives", () => {
    const { result } = renderHook(() => useCountUp(100, true, 1000));

    tick(250);
    const early = result.current;
    tick(250);
    const middle = result.current;
    tick(500);

    expect(early).toBeGreaterThan(0);
    expect(middle).toBeGreaterThan(early);
    // Ease out: half the time brings more than half the way.
    expect(middle).toBeGreaterThan(50);
    expect(result.current).toBe(100);
    expect(queue).toHaveLength(0);
  });

  it("gives the target at once for a visitor who asks for reduced motion", () => {
    reduceMotion(true);

    const { result } = renderHook(() => useCountUp(856, true));

    expect(result.current).toBe(856);
    expect(queue).toHaveLength(0);
  });

  it("stops the count when the component goes away", () => {
    const { unmount } = renderHook(() => useCountUp(100, true, 1000));
    expect(queue).toHaveLength(1);

    unmount();

    expect(queue).toHaveLength(0);
  });
});
