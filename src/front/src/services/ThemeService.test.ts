import { afterEach, describe, expect, it, vi } from "vitest";

import { PreferenceStore } from "./PreferenceStore";
import { ThemeService } from "./ThemeService";

function memoryStore(initial?: string): PreferenceStore {
  const values = new Map<string, string>();
  if (initial) values.set(ThemeService.KEY, initial);
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function mockSystem(prefersLight: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: prefersLight && query.includes("light") }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeService", () => {
  it("is dark by default", () => {
    const service = new ThemeService(memoryStore(), document.createElement("html"));

    expect(service.current()).toBe("dark");
  });

  it("follows the system when the user has not chosen", () => {
    mockSystem(true);
    const service = new ThemeService(memoryStore(), document.createElement("html"));

    expect(service.current()).toBe("light");
  });

  it("prefers the saved choice to the system", () => {
    mockSystem(true);
    const service = new ThemeService(memoryStore("dark"), document.createElement("html"));

    expect(service.current()).toBe("dark");
  });

  it("ignores an invalid saved value", () => {
    const service = new ThemeService(memoryStore("blue"), document.createElement("html"));

    expect(service.current()).toBe("dark");
  });

  it("puts the chosen theme on the page and remembers it", () => {
    const root = document.createElement("html");
    const store = memoryStore();
    new ThemeService(store, root).set("light");

    expect(root.getAttribute("data-theme")).toBe("light");
    expect(new ThemeService(store, root).current()).toBe("light");
  });

  it("leaves the page without a theme attribute until the user chooses", () => {
    const root = document.createElement("html");
    root.setAttribute("data-theme", "light");

    new ThemeService(memoryStore(), root).apply();

    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});
