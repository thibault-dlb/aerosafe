import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useScrolled } from "./useScrolled";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

afterEach(() => scrollTo(0));

describe("useScrolled", () => {
  it("is false at the top of the page", () => {
    const { result } = renderHook(() => useScrolled(40));

    expect(result.current).toBe(false);
  });

  it("turns true past the threshold and back to false when the page returns to the top", () => {
    const { result } = renderHook(() => useScrolled(40));

    act(() => scrollTo(41));
    expect(result.current).toBe(true);

    act(() => scrollTo(10));
    expect(result.current).toBe(false);
  });

  it("is already true when the page opens scrolled down", () => {
    scrollTo(500);

    const { result } = renderHook(() => useScrolled(40));

    expect(result.current).toBe(true);
  });

  it("stops listening when the component goes away", () => {
    const { unmount } = renderHook(() => useScrolled(40));
    unmount();

    expect(() => scrollTo(500)).not.toThrow();
  });
});
