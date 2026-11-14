import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "./useMediaQuery";

function stubMedia(initial: boolean) {
  let listener: () => void = () => undefined;
  const list = {
    matches: initial,
    addEventListener: (_: string, callback: () => void) => (listener = callback),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => list);
  return {
    list,
    change(matches: boolean) {
      list.matches = matches;
      listener();
    },
  };
}

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false where the browser cannot say", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(renderHook(() => useMediaQuery("(max-width: 720px)")).result.current).toBe(false);
  });

  it("follows the query", () => {
    const media = stubMedia(true);
    const { result, unmount } = renderHook(() => useMediaQuery("(max-width: 720px)"));
    expect(result.current).toBe(true);

    act(() => media.change(false));
    expect(result.current).toBe(false);

    unmount();
    expect(media.list.removeEventListener).toHaveBeenCalled();
  });
});
