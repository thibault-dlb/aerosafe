import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReveal } from "./useReveal";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

class FakeObserver {
  static instances: FakeObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(
    public callback: Callback,
    public options: { threshold: number },
  ) {
    FakeObserver.instances.push(this);
  }
}

function reduceMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}

/** Puts an element in the ref, as React does once the component is on screen. */
function withElement<T extends HTMLElement>(value: ReturnType<typeof useReveal<T>>) {
  value[0].current ??= document.createElement("section") as unknown as T;
  return value;
}

beforeEach(() => {
  FakeObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  reduceMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useReveal", () => {
  it("counts the element as seen at once when the browser cannot observe it", () => {
    vi.unstubAllGlobals();

    const { result } = renderHook(() => useReveal());

    expect(result.current[1]).toBe(true);
  });

  it("counts the element as seen at once for a visitor who asks for reduced motion", () => {
    reduceMotion(true);

    const { result } = renderHook(() => useReveal());

    expect(result.current[1]).toBe(true);
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it("waits for the element to come into view, then stays seen", () => {
    const { result } = renderHook(() => withElement(useReveal<HTMLElement>(0.4)));
    const [observer] = FakeObserver.instances;
    expect(result.current[1]).toBe(false);
    expect(observer.options.threshold).toBe(0.4);
    expect(observer.observe).toHaveBeenCalledOnce();

    act(() => observer.callback([{ isIntersecting: false }]));
    expect(result.current[1]).toBe(false);

    act(() => observer.callback([{ isIntersecting: true }]));
    expect(result.current[1]).toBe(true);
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("does not observe while there is no element", () => {
    const { result } = renderHook(() => useReveal<HTMLElement>());

    expect(result.current[1]).toBe(false);
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it("stops observing when the component goes away", () => {
    const { unmount } = renderHook(() => withElement(useReveal<HTMLElement>()));
    const [observer] = FakeObserver.instances;

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});
