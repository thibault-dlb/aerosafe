import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revert, to } = vi.hoisted(() => ({ revert: vi.fn(), to: vi.fn() }));

vi.mock("gsap", () => ({
  gsap: {
    registerPlugin: vi.fn(),
    context: (setup: () => void) => {
      setup();
      return { revert };
    },
    to,
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

import { useScrollProgress } from "./useScrollProgress";

interface Tween {
  value: number;
}
interface Settings {
  onUpdate: () => void;
  scrollTrigger: { start: string; end: string; scrub: number };
}

function section() {
  return { current: document.createElement("section") };
}

function reduceMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduced }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  revert.mockClear();
  to.mockClear();
  reduceMotion(false);
});

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useScrollProgress", () => {
  it("starts at 0 and follows the scroll of the element", () => {
    const { result } = renderHook(() => useScrollProgress(section()));
    expect(result.current).toBe(0);

    const [state, settings] = to.mock.calls[0] as [Tween, Settings];
    expect(settings.scrollTrigger).toMatchObject({ start: "top top", end: "bottom bottom", scrub: 0.6 });
    act(() => {
      state.value = 0.5;
      settings.onUpdate();
    });

    expect(result.current).toBe(0.5);
  });

  it("lets the caller choose how smooth the follow is", () => {
    renderHook(() => useScrollProgress(section(), 1.4));

    expect((to.mock.calls[0][1] as Settings).scrollTrigger.scrub).toBe(1.4);
  });

  it("does not play the scene for a visitor who asks for reduced motion", () => {
    reduceMotion(true);

    const { result } = renderHook(() => useScrollProgress(section()));

    expect(result.current).toBe(0);
    expect(to).not.toHaveBeenCalled();
  });

  it("does nothing while there is no element", () => {
    const { result } = renderHook(() => useScrollProgress({ current: null }));

    expect(result.current).toBe(0);
    expect(to).not.toHaveBeenCalled();
  });

  it("releases the scroll trigger when the component goes away", () => {
    const { unmount } = renderHook(() => useScrollProgress(section()));

    unmount();

    expect(revert).toHaveBeenCalledOnce();
  });
});
